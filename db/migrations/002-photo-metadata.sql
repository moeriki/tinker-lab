-- Photos are stored exactly as the camera produced them, so the gallery has to be told what it
-- is about to render before it renders it -- see docs/adr/0008-photos-are-stored-as-they-arrive.md.
--
-- photo_mime  the sniffed type, from magic bytes and never the filename. HEIC arrives from
--             iPhones and Chrome will not display it, so the gallery needs to know in advance
--             and offer a download tile instead of a broken <img>.
-- photo_thumb the extracted EXIF thumbnail's filename, or NULL when the camera embedded none.
--             Null is normal, not an error: HEIC and PNG have none, and the tile falls back.

alter table submissions add column photo_mime text;
alter table submissions add column photo_thumb text;
