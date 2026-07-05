\version "2.24.2"

%% Session-set 007 round-trip: same music as the engine repo's golden
%% joy-to-the-world.ly, but the notation config is the Configurator-
%% generated export instead of the hand-written Kite include. The golden
%% score's CB-safe color overrides are baked into the generated config.
\include "kite-4-369-from-configurator.ly"
\include "cnb/test-ids.ly"

\book {
  \header {
    title="Joy to the World"
    composer = "Isaac Watts & Lowell Mason"    
  }

  \markup  { #cnb:notation-label \footnote "*" #cnb:notation-footnote }

  \paper {
    indent = #cnb:indent  
    left-margin = #5
    right-margin = #5
    system-system-spacing =
      #'((basic-distance . 12) 
         (minimum-distance . 8)
         (padding . 4)
         (stretchability . 60))
  }

  \new Staff
  \with {
        \magnifyStaff #cnb:default-magnify
      }
  \relative {
     \clef treble
     \key d \major
     \time 2/4
     d''4 cis8. b16 | a4. g8 | fis4 e | d4. a'8 |  b4. b8 | cis4. cis8 | \break
     d4. d8 | d( cis) b( a) | a8.( g16 fis8) d' | d( cis) b( a) | a8.( g16 fis8) fis | \break
     fis fis fis fis16( g) | a4. g16( fis) | e8 e e e16( fis) |  \break
     g4. fis16( e) | d8( d'4) b8 | a8.( g16 fis8) g8 | fis4 e | d2
     \fine
   }
}
