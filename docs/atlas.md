# Sprite atlases

Layouts belong to the texture thread: `public/textures/atlas/mat_atlas_{signs,billboard,decal}.json` (`sprites.<name> = {x,y,w,h}`, UV space, top-left origin, already inset). `tools/gen/lib/atlas.mjs` reads them verbatim: `spriteRect(atlas, name)` throws on an unknown name, `spriteAspect` gives the panel w:h a sprite is painted for.
Pass the rect as `uv` to `b.quad()`; atlas UVs are baked at generation time.

Which sprite suits which sign (`tools/gen/lib/signs_sprites.mjs` is the single table, picked by `kind` and panel aspect):
- `mat_atlas_signs`: 1:1 art for wall/blade/roof boards (`ramen`, `bar`, `hotel`, `clinic`, `arcade`, `bank`, `neon_*`, `arrow_*`, `hazard_stripes`...). `vertical_sign_1..6` only on ~1:3 tall panels, `wide_*` only on ~3:1 wide panels.
- `mat_atlas_billboard`: panel aspect = rect w:h (2:1 `ad_*` and `*_hero`, 4:1 `*_wide` / `*_banner`, 1:2 `ad_halcyon_tall`).
- Pure neon lettering is not atlas art: it is `mat_neon_*` geometry (`neonText`). `mat_atlas_decal` is for the city layout, not signs.
