# OPAIJA Trailer Quality Reference

Primary style references copied into the project:

- `public/assets/style-references/opaija-character-bible-heroes.png`
- `public/assets/style-references/opaija-character-bible-villains-guardians.png`
- `public/assets/style-references/opaija-premium-action-title-01.png`
- `public/assets/style-references/opaija-premium-action-title-02.png`

Secondary motion/finish reference: `C:\Users\RAY\Downloads\raytattoos_httpss.mj.run742034KrasU_Image1_Image2_Image3_Ultr_d730e109-270d-4cca-9f30-ca2cec63b3be_0.mp4`

Extracted inspection frames:

- `out/reference-style/midjourney-quality/reference-1.png`
- `out/reference-style/midjourney-quality/reference-2.png`
- `out/reference-style/midjourney-quality/reference-3.png`

## Target Look

Use the ChatGPT bible sheets as the character/style source. Use the premium action references as the Episode 1 teaser/trailer finish target:

- Premium cinematic 2D Trini anime action trailer.
- Dark charcoal/brown environment with controlled gold/orange Opaija energy.
- Heavy contrast, warm rim light, glowing staff effects, impact sparks, flying debris, cracked ground, and strong depth.
- Dynamic low-angle martial poses with readable staff silhouettes and clear body mechanics.
- Complete staff/bois visibility in action panels: show weapon tip-to-tip with at least 10% safe margin unless the shot is an intentional close-up.
- Sharp anime/comic finish: clean black linework, high-detail cel shading, dramatic shadows, no plastic 3D, no photoreal faces.
- Camera feels kinetic: push-ins, whip energy, impact framing, heroic foreshortening, 24fps action-trailer feel.
- Final image should feel expensive, franchise-ready, and closer to a premium anime trailer frame than a flat storyboard test.

## Character Rule

The secondary trailer reference does not override the approved ChatGPT bible sheets. Every frame must still preserve:

- Kai's black sleeveless hoodie, red/orange sash, seed pendant, warm brown skin, medium loc silhouette, and The Listening Bois.
- Each character's exact approved face, hair, wardrobe, props, color accents, and silhouette from `public/assets/characters/`.

## Text Rule

The reference video includes large OPAIJA title lettering. Do not bake generated title text, fake signage, labels, subtitles, or logos into AI artwork by default. Add title, CTA, captions, and logos in the editor/Remotion layer unless a deliberate hero-title shot is requested.

## Provider Rule

For exact-character rebuilds, prefer `KEYFRAME_IMAGE_PROVIDER=gemini` with `GEMINI_API_KEY` or `GOOGLE_API_KEY` configured so the provider can receive the bible sheets as image inputs. Text-only OpenAI generation is allowed only for scratch tests because it has already shown style drift and cropped weapon failures.
