# JetBrains Mono NL

JetBrains Mono without ligatures ("NL"), version 2.304, licensed under the SIL Open Font License 1.1 (`OFL.txt`, which reserves no font name).

JetBrains publishes the NL faces only as TTF, and they are not on npm. These woff2 files are lossless conversions of the TTFs in the official release, with no subsetting:

- Source: https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip (SHA-256 `6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf`), files `fonts/ttf/JetBrainsMonoNL-{Regular,SemiBold,Bold,Italic,BoldItalic}.ttf`
- Converted with fontTools (`pip install fonttools brotli`):

  ```python
  from fontTools.ttLib import TTFont
  font = TTFont('JetBrainsMonoNL-Regular.ttf')
  font.flavor = 'woff2'
  font.save('JetBrainsMonoNL-Regular.woff2')
  ```

Lantern uses weights 400, 600 and 700 and the 400 and 700 italics.
