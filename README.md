# guestwifi

Type your WiFi name and password once and print a card with a QR code. Guests point their phone camera
at it and join, no spelling out passwords.

Live: https://mridulsaravanan.com/guestwifi/

- **Three cards.** A small fridge card (9 x 13 cm), an A5 card for a photo frame, or a table tent you fold in half.
- **Save as image** to send the card on WhatsApp or anywhere else.
- **Catches typos before you print.** It warns about passwords that are too short for WPA, names longer than
  32 characters, stray spaces, and characters that look alike (O and 0, I, l and 1).
- **Handles awkward names.** Semicolons, commas, colons, quotes, backslashes, accents and non-Latin scripts are
  escaped the way phones expect.
- Only the card's look (style, heading, note) is remembered on the device. The network name and password are not.

`engine.js` builds and checks the `WIFI:` text and the QR grid. `index.html` is the page.

Credits: QR code generator by Kazuhiko Arase (MIT licence, `assets/qrcode.js`). QR Code is a registered trademark of
DENSO WAVE INCORPORATED. Font: Pixelify Sans (SIL Open Font License, `assets/OFL-PixelifySans.txt`).

Testing: 76 engine checks, and 76 browser checks on desktop and a 390 px phone. Every QR code the page shows or
saves is scanned with zxing-cpp and compared with what was typed, including names with `; , : " \`, accents and
Hindi.
