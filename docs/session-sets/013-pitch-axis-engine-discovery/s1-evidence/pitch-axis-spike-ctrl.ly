\version "2.24.2"

%% ============================================================================
%% THROWAWAY PROOF — set 013 session 1 (pitch-axis engine discovery spike)
%%
%% Question: can the CNB engine be coerced into placing noteheads, stems,
%% and ledgers from an arbitrary many-to-one semitone -> staff-position map
%% (a Twinline-like 7-position octave holding 12 pitch classes), WITHOUT
%% modifying engine source?
%%
%% Method: a score-level engraver that simulates the proposed engine hook
%%   cnb:get-pitch-staff-position (lambda (semitone) ...) -> half-staff-spaces
%% by re-setting NoteHead.Y-offset at stop-translation-timestep (guaranteed
%% to run after the engine's cnb-notehead-engraver acknowledger, which sets
%% the linear-formula Y-offset at acknowledge time). Shared-position pitch
%% classes additionally get their stencil translated right by a fixed
%% staff-space amount (the x-offset disambiguation candidate mechanism).
%%
%% This file is NOT a product fixture. It changes no engine source.
%% ============================================================================

\include "ChromaticNotationBase.ly"
\include "cnb/test-ids.ly"

%% Isolate the placement question: no clef, no key signature.
#(set! cnb:clef-style 'none)
#(set! cnb:keysig-style 'none)

%% Compact staff: 3 lines per octave at axis positions {1,3,5} within the
%% 7-position octave, two octaves of staff shown.
%% Axis anchor: middle C (ly:pitch-semitones = 0) at LilyPond position -4.
%% Octave 0 lines -> positions {-3,-1,1}; octave 1 lines -> {4,6,8}.
#(set! cnb:staff-line-positions '(-3 -1 1 4 6 8))

%% --- The compact pitch axis (Twinline-like: 12 pcs on 7 positions) ------
%% pc:        0  1  2  3  4  5  6  7  8  9 10 11
%% position:  0  0  1  2  2  3  3  4  5  5  6  6
%% Shared pairs: (C,C#) (D#,E) (F,F#) (G#,A) (A#,B); D and G unshared.
#(define spike:pc-axis (vector 0 0 1 2 2 3 3 4 5 5 6 6))
#(define spike:octave-stride 7)
#(define spike:anchor -4)

%% The proposed hook, simulated: semitone -> LilyPond staff position
%% (half-staff-spaces from staff center, same unit as
%% cnb:staff-line-positions).
#(define (spike:get-pitch-staff-position semitone)
   (let* ((pc  (modulo semitone 12))
          (oct (quotient (- semitone pc) 12)))
     (+ (* oct spike:octave-stride)
        (vector-ref spike:pc-axis pc)
        spike:anchor)))

%% Disambiguation: the sharper member of each shared pair is shifted right.
%% Implemented by translating the already-built notehead stencil along X,
%% so the grob's extent moves with it (the mechanism an engine-side
%% (x-offset . N) field would use).
%% x-offset value below is in staff-spaces
#(define spike:x-offset-pcs '(1 4 6 9 11))
#(define spike:x-offset 0.0)

#(define spike-pitch-axis-engraver
   (lambda (context)
     (let ((heads '()))
       (make-engraver
         (acknowledgers
           ((note-head-interface engraver grob source-engraver)
             (set! heads (cons grob heads))))
         ((stop-translation-timestep translator)
           (for-each
             (lambda (grob)
               (let* ((event       (ly:grob-property grob 'cause))
                      (pitch       (ly:event-property event 'pitch))
                      (semis       (ly:pitch-semitones pitch))
                      (staff-def   (ly:context-grob-definition context 'StaffSymbol))
                      (staff-space (or (assq-ref staff-def 'staff-space) 1.0))
                      (pos         (spike:get-pitch-staff-position semis)))
                 ;; Override the engine's linear Y with the mapped position.
                 (ly:grob-set-property! grob 'Y-offset
                       (* pos 0.5 staff-space))
                 ;; Horizontal disambiguation for shared positions.
                 (if (memv (modulo semis 12) spike:x-offset-pcs)
                     (let ((sten (ly:grob-property grob 'stencil)))
                       (if (ly:stencil? sten)
                           (ly:grob-set-property! grob 'stencil
                                 (ly:stencil-translate-axis
                                   sten spike:x-offset X)))))))
             heads)
           (set! heads '()))))))

\layout {
  \context {
    \Staff
    \consists #spike-pitch-axis-engraver
    \omit TimeSignature
  }
}

\score {
  \new Staff {
    \time 4/4
    %% m1-m3: full chromatic octave, crotchets (stems + shared positions)
    c'4 cis' d' dis' |
    e' f' fis' g' |
    gis' a' ais' b' |
    %% m4: second octave spot checks (octave stride)
    c''4 d'' e'' g'' |
    %% m5: above-staff ledger exercise
    ais''4 b'' c''' c''' |
    %% m6: below-staff ledger exercise
    b4 a gis g |
    %% m7: shared-position chord, on-line shared chord, normal chord, shared pair
    <c' cis'>4 <gis' a'> <c' g'> <f' fis'> |
    %% m8-m9: duration coverage (repeat-mode minims, semibreve)
    c''2 e'' |
    c''1 |
  }
}
