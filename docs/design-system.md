# Remelle design system

Desktop storefront specification measured from Figma file `cSfvnDeq5pIcWUn0BM5VuT`, page Desktop (`0:1`).

Named colors and type styles come from variables on the landing page. Sizes and positions on the other frames come from node geometry. Fills, text styles, radii, strokes, and `clipsContent` were not returned for the shop, product, About, Contact, or returns frames. Do not invent those values.

## Frames

Every storefront frame is 1440px wide.

| Frame | Node | Height | Content starts |
|---|---|---|---|
| Landing page | `60:2272` | 4728 | y = 85, 1px overlap into the nav |
| Listing, shop grid | `101:20` | 1943 | y = 134, 48px under the 86px header |
| Listing, product | `101:709` | 2350 | y = 134, 48px under the header |
| About | `107:1308` | 2516 | y = 86, flush under the nav |
| Contact | `108:2442` | 1281 | y = 231, 145px under the header |
| Return & exchange | `108:3145` | 1794 | Article at y = 158, 72px under the header |

A frame named Our approach (`1440 × 708`) sits on the Desktop page and was not opened. The Branding page is a separate set of `1920 × 1080` boards. No storefront frame below 1440 exists, so mobile and tablet behavior cannot be determined.

## Layout

| Token | Value | Source |
|---|---|---|
| `page.width` | 1440px | Every storefront frame |
| `page.inset` | 48px | Nav, announcement, hero copy, collection, story, footer, shop, product |
| `page.content` | 1344px | 1440 − 48 − 48 |
| `header.announcement` | 30px | Announcement height |
| `header.nav` | 56px | Nav bar, 16px vertical padding |
| `header.total` | 86px | 30 + 56 |
| `section.gap` | 0 | Landing sections abut |
| `radius.none` | 0 | Homepage buttons, photos, story image, fields |
| `radius.badge` | 1px | “new in” badge |
| `radius.control` | 2px | 40px quick-add square |
| `radius.swatch` | circle | 16 × 16 ellipses |

On the landing page the section stack starts at y = 85, so it overlaps the nav by 1px. Sticky behavior is not specified. The header is in normal flow at the top of each frame.

Contact uses a 56px side inset. The returns article is a 620px column centered at x = 410.

## Color

Named variables on the landing page:

| Name | Hex | Use |
|---|---|---|
| Burgundy | `#670D0D` | Announcement, footer, eyebrows, headings, dark button, quick add, progress fill |
| Beige | `#F5EDE3` | Nav, house introduction, product photo ground, light button, announcement and footer text |
| Off white | `#FAF5F0` | New collection background. Dark button label and border. Newsletter submit label |
| Black | `#060505` | House introduction body only |

Fills with no variable, homepage only:

| Value | Where |
|---|---|
| `#FFFDFC` | Hero headline and slide index |
| `#D6D6D6` | Hero description |
| `#242424` | Product name, price, badge text, “+ 2” |
| `#FBF7F1` | Brand story background |
| `#241715` | Brand story body |
| `#FFFFFF` | “new in” badge, editorial image base |
| `rgba(20, 8, 7, 0.02)` → `rgba(20, 8, 7, 0.40)` | Hero slide 01 gradient, top to bottom |
| `rgba(20, 8, 7, 0.03)` → `rgba(20, 8, 7, 0.53)` | Hero slide 02 gradient, top to bottom |
| `rgba(0, 0, 0, 0.10)` | Editorial image overlay |
| `rgba(245, 237, 227, 0.30)` | Footer divider |
| `#F5EDE3` at 60% opacity | Newsletter placeholder and copyright |
| `#FFFDFC` at 30% opacity | Inactive hero slide number |

No additional named colors were returned for the other frames. Swatch hex values, icon glyph colors, and the unfilled progress stroke were not returned.

## Type

Instrument Sans is a variable font with the width axis at 100. Instrument Serif is Regular only. Figma stores letter-spacing as a percent. The pixel column is the computed homepage value.

| Figma style | Family | Weight | Size | Line height | Tracking |
|---|---|---|---|---|---|
| Display | Instrument Serif | 400 | 74 | 0.96 | −0.74px (−1%) |
| Section heading | Instrument Serif | 400 | 56 | 56px | −1.12px (−2%) |
| Body-lg-reg | Instrument Sans | 400 | 16 | 22px | 0 |
| Body-md-reg | Instrument Sans | 400 | 14 | 1.2 | 0 |
| Body-md-sb | Instrument Sans | 600 | 14 | 1.2 | 0 |
| Body-sm-md | Instrument Sans | 500 | 12 | 100% (export: normal) | 1.44px (12%) |
| Body-sm-sb | Instrument Sans | 600 | 12 | 100% (export: normal) | 0.96px (8%) |
| Body-sm-reg | Instrument Sans | 400 | 12 | 100% (export: normal) | 0 |
| caption-sb | Instrument Sans | 600 | 10 | 12px | 1.6px (16%) |
| caption-reg | Instrument Sans | 400 | 10 | 12px | 0 |

| Role | Style | Case | Color |
|---|---|---|---|
| Hero headline | Display | Sentence | `#FFFDFC` |
| Section title and story statement | Section heading | Sentence | Burgundy |
| Eyebrow and nav link | Body-sm-md | Uppercase | Burgundy |
| Long copy | Body-lg-reg | Sentence | Black, `#D6D6D6`, or `#241715` by section |
| Product name | Body-md-reg | As written, nowrap | `#242424` |
| Price | Body-md-sb | As written | `#242424` |
| Button label | Body-sm-sb | Uppercase | Burgundy or Off white |
| Footer title, View all, Send | caption-sb | Uppercase | Beige, Burgundy, or Off white |
| Announcement and badge | caption-reg | Uppercase | Beige or `#242424` |
| Footer link | Body-sm-reg | As written | Beige |

Outside the named styles:

| Text | Face | Size | Other |
|---|---|---|---|
| “Intention & authenticity” | Snell Roundhand Regular | 56 | Line height 0.98, tracking −1.4px, Burgundy |
| Hero index 01 / 02 | Instrument Sans Regular | 11 | Line height normal. Inactive number at 30% opacity |
| “+ 2” | Inter Regular | 13 | Line height 1.2, `#242424` |

On the newer frames, font, weight, tracking, and color were not returned. Box height is the only type evidence:

| Text node | Box | Match |
|---|---|---|
| Shop, About, policy, and contact titles | 56px tall | Same line box as Section heading |
| Eyebrows | 15px tall | Same line box as Body-sm-md |
| Policy body, contact labels, PDP description, About paragraphs | 22px, or a multiple of 22 | Same line box as Body-lg-reg |
| Product names, FAQ questions, contact message | 17px tall | Same line box as Body-md |
| PDP product title `101:1044` | 282 × 36 | No named style |
| PDP price `101:1061` | 112 × 24 | No named style |
| About value title | 35px tall | No named style |
| “Est. 2026” and “Clothing brand” | 6px tall | No named style |

## Spacing

There is no spacing variable set. These are instance measurements.

| Use | px |
|---|---|
| Page inset | 48 |
| Collection and story padding, block axis | 80 |
| Heading to the block below | 48 |
| Footer padding top / bottom | 80 / 48 |
| Footer link row to wordmark | 48 |
| Footer divider inset under links | 32 |
| Wordmark to copyright | 32 |
| Editorial heading from top | 56 |
| Eyebrow to title | 20 |
| House intro: eyebrow to headline / headline to body | 24 / 16 |
| Hero: eyebrow to headline / headline lines / headline to description / copy to button | 20 / 2 / 12 / 40 |
| Story: statement to body to button | 32 |
| Story columns and footer columns | 88 |
| Nav link gap | 24 |
| Product card gap | 16 |
| Photo to product text | 20 |
| Product name to price row | 12 |
| Price to swatches | 17 |
| Swatches to “+ 2”, and swatch overlap | 4 |
| Photo inner padding | 10 |
| Button height / inline padding / label to icon | 48 / 20 / 8 |
| View all padding top / bottom, label to icon | 10 / 4, 10 |
| Footer title to links / links | 16 / 12 |
| Newsletter title to field / row to underline | 8 / 12 |
| Social label to icon | 2 |
| Slide index gap, and offset from bottom / right | 12, 42 / 48 |

Measurements that appear only on the later frames:

| Use | px |
|---|---|
| Shop header to the card grid | 64 |
| Shop row to the next row | 80 |
| Contact side inset | 56 |
| Contact intro to form | 142 |
| Contact field to the next | 20 |
| Contact fields to the submit button | 48 |
| Policy section to the next | 24 |
| Policy paragraph to the next | 10 |
| Policy article under the header | 72 |
| Contact block under the header | 145 |
| PDP gallery tile gap | 8 |
| PDP gallery to the buy box | 48 |
| PDP buy-box block to the next | 24 |
| Colour option gap | 8 |
| Size option gap | 6 |
| Quantity control gap | 4 |
| Add to basket to the wishlist square | 8 |
| About value columns | 64 |
| About FAQ columns | 175 |
| PDP recommendation header from the section top | 104 |
| PDP recommendation space under the controls | 56 |

## Shared chrome

Announcement, nav, and footer are on all six frames. The nav is an instance. The announcement and footer are separate frames, so a matching box does not prove a matching fill.

| Piece | What matches | What differs |
|---|---|---|
| Announcement | 1440 × 30. Message box 189 × 12 at x = 625.5, y = 9 | String and fills were not re-read on every frame |
| Nav bar | Instance, 1440 × 56, y = 30 | Child overrides were not expanded |
| Footer links | Groups 608 × 97. Columns at x = 0, 169, 339, 534. Gap 88. Newsletter 305 × 48 at x = 1039. Inset 48 | No structural difference |
| Footer wordmark | Landing, shop, and product: 469.333 × 87.789, footer height 439.789 | About, Contact, and returns: 469.300 × 87.994, footer height 439.994 |

Homepage chrome, from the design-context read:

- Announcement: Burgundy, centered caption-reg uppercase in Beige. Copy: “Free delivery on your first order”. No link.
- Nav: Beige, padding 16 × 48. Zones of 420px, a 128 × 24 wordmark SVG, and 420px. Link gap 24. Labels: Shop, About, Account, contact, Cart (0). “contact” is lowercase in the file and uppercased by the style. Cart count is one text node.
- Footer: Burgundy. Titles caption-sb uppercase Beige. Links Body-sm-reg Beige. Divider `rgba(245, 237, 227, 0.30)`. Instagram and Tiktok use a 16px arrow-up-right. Copyright is Body-sm-reg Beige at 60% opacity: “© 2026 Remelle, all rights reserved”.

## Components

No hover or focus variant exists. Pointer cursor is on nav links, the hero button, the coat card, and the story button.

### Editorial button

Height 48, inline padding 20, gap 8, radius 0, width hugs the label. Label is Body-sm-sb, uppercase, tracking 0.96px. Trailing icon is arrow-up-right at 24px.

| Variant | Fill | Border | Label | Example |
|---|---|---|---|---|
| Light | `#F5EDE3` | 1px `#F5EDE3` | Burgundy | Discover the winter collection (width 319) |
| Dark | `#670D0D` | 1px `#FAF5F0` | Off white | Read our story (width 189) |

The About invitation button is the same 319 × 48 box.

### Editorial link

“View all” is caption-sb, uppercase, tracking 1.6px, Burgundy, bottom border only, padding 10px top and 4px bottom, 10px gap to a 16px arrow-up-right. Newsletter “send” uses the same type style in Off white, with a 2px gap to a 16px arrow. The field underline is a separate 305px Beige rule.

### Section heading

Eyebrow is Body-sm-md, uppercase, Burgundy, tracking 1.44px, in the pattern “0N — label”. Title is Section heading, Burgundy, in a 720px column. Gap is 20px.

### Product card

The homepage card and the product-page recommendation card are the same size. The shop grid card is smaller. They are not two layouts of one card.

| Measurement | Carousel card | Shop grid card |
|---|---|---|
| Where | Landing `60:2307` and recommendations `101:1122` | Shop rows `101:250` and `101:362` |
| Card | 363 × 550 | 323 × 497 |
| Photograph | 363 × 484, ratio 3:4 | 323 × 431. Not 3:4 |
| Text block | 363 × 46 at y = 504 | 323 × 46 at y = 451 |
| Photo to text | 20px | 20px |
| Name to price | 12px. Price row is 17px tall | Same |
| Swatches | 16px circles, second at x = 12, 4px overlap, 17px after the price | Same geometry when present |
| Cards in the row | 4, at x = 0, 379, 758, 1137 | Row 1 has 4 at x = 0, 339, 678, 1017. Row 2 has 3 |
| Gap | 16px. 4 × 363 + 3 × 16 = 1500 | 16px. 4 × 323 + 3 × 16 = 1340, so 4px of the 1344px row is unused |
| Row box | 1500 × 550 at x = 48 | 1344 × 497. Vertical gap to the next row is 80 |
| Track vs frame | Right edge at x = 1548, 108px past the 1440 frame and 156px past the 1344 content box | The row is the content box. Every card ends inside it |
| Controls | Progress frame 1344 × 32. Track 862 wide. Lines 396 and 821, the second starting at x = 396. Arrows 32px in an 80 × 32 group | None |

The 1500px figure is the carousel track, not the viewport. The fourth card is a full 363px layer. Its absolute x is 1185, so 207px of it sits inside the content box (ending at 1392) and 255px sits inside the 1440 frame. `clipsContent` was not returned, so that crop is geometry, not a confirmed clip. Click distance is not defined.

Homepage photograph styling: Beige ground, 10px inner padding, badge, 20px heart, 40px Burgundy quick-add with 2px radius and a 24px plus. Image fit is not one rule: the blazer is inset, the coat and hoodie use cover, the pants use contain. The component set Product photograph (`101:218`) has a 363 × 484 default symbol. Shop card `101:265` instances it at 323 × 431. Two cards omit swatches: shop `101:276` and recommendation `101:1151`.

### Hero

1440 × 740, object-fit cover. Copy at left 48, top 314, width 720. Index 42px from the bottom and 48px from the right. Slide 02 changes the image crop, the gradient, and which digit is active. The headline and button sit outside the component, so they do not swap with the slide.

### Shop header

1344 × 91, then 64px, then the grid. The eyebrow is three text nodes, 42 × 15, 6 × 15, and 38 × 15, with 12px between them. The title is 94 × 56, 20px under that row. Characters were not returned. A 159 × 16 sort control sits at x = 1185, y = 75. Its label is 135 × 12. A 16px chevron-down sits 8px to its right.

### Product gallery and buy box

Product block is 1344 × 834 at x = 48. Gallery is 742 × 834: two tiles of 367 × 413 with an 8px gap, and a 742 × 413 tile 8px below. Buy box is 548 × 761 at x = 790. Column gap is 48px. Gallery plus gap plus buy box is 1338, 6px short of 1344.

| Block | Box | Inside it |
|---|---|---|
| Heading | 410 × 66 | Title 282 × 36, then 6px, then price 112 × 24 |
| Description | 548 × 22 at y = 90 | 24px after the heading |
| Colour | 410 × 140 at y = 136 | Two option frames 81 × 114, gap 8 |
| Size | 548 × 68 at y = 300 | Two options 81 × 42, gap 6 |
| Quantity | 410 × 65 at y = 392 | 40px minus, 4px, 81 × 40 value, 4px, 40px plus. Icons 24px |
| Purchase | 548 × 44 at y = 481 | Add to basket 494 × 44. Wishlist 46 × 44, gap 8, 24px heart |
| Information | 548 × 212 at y = 549 | Four rows, 548 × 53, stacked flush. 15 × 15 expand icon. No answer text is in the file |

No selected state is named on the size or colour options. Fills, strokes, and radii were not returned.

### Contact form

Intro is 419 × 165 at x = 56. Eyebrow 146 × 15, title 218 × 56 with a 12px gap, description 419 × 66. Form column is 767 × 409 at x = 617. Four fields stack with 20px between blocks. The submit frame is named Add to basket, 767 × 44, 48px under the fields. It is 4px shorter than the 48px editorial button. Label strings were not returned. Each input is a full-width box with a zero-height separator on the bottom edge. The message field also has a 12 × 12 frame at x = 755.

### Policy article

One centered column, 620 × 1068 at x = 410, y = 158. Title is 620 × 56. Body starts 48px under the title. Five sections, 24px between them, 10px between paragraphs.

| Section | Box | Heading |
|---|---|---|
| 1 | 620 × 272 | 1- Eligibility: |
| 2 | 620 × 228 | 2- Return and Exchange Procedure: |
| 3 | 620 × 98 | 3-Fees: |
| 4 | 620 × 108 | 4-Refund Process: |
| 5 | 620 × 162 | 5-Contact Us: |

### About

| Section | Frame | Layout |
|---|---|---|
| Our story | 1440 × 698 | Image 624 × 570 at x = 48. Copy 632 × 309 at x = 760. Column gap 88. Statement and body are 530 wide with 32px between them |
| Our values | 1440 × 453 | Padding 80. Three columns, 405.333 wide, gap 64. Title box is 35px tall |
| FAQ | 1440 × 466 | Intro 480, list 689, gap 175. Open item 689 × 114. Closed items 689 × 64. Icons 24px |
| Collection invitation | 1440 × 373 | Centered eyebrow, 580px description, and the 319 × 48 button. Gaps 24 |

The story image contains a 300 × 119.683 lockup. The FAQ contact link is 103 × 30, which is a different box from the 30px View all link.

### Icons

| Icon | Size | Used on |
|---|---|---|
| arrow-up-right | 24 | Editorial buttons |
| arrow-up-right | 16 | View all, Instagram, Tiktok, Send |
| heart | 20 | Product photo, top right |
| plus | 24 | Inside the 40px quick-add |
| arrow-narrow-left | 32 | Carousel previous |
| arrow-right | 32 | Carousel next |
| heart | 24 | PDP wishlist square, 46 × 44 |
| minus | 24 | PDP quantity, inside a 40px square |
| chevron-down | 16 | Shop sort control |
| expand | 15 | PDP information rows |
| collapse / expand | 24 | About FAQ |

## Unresolved

- Hover and focus styles.
- Mobile and tablet layouts.
- Whether the header is sticky.
- Whether the 1500px carousel row is clipped, and how far it moves per arrow. The second progress line color was not returned.
- Fills, type styles, radii, and strokes on shop, product, About, Contact, and returns.
- Which colour and size option is selected.
- Contact field strings, the shop eyebrow characters, and the sort label.
- A chat control. Contact copy mentions one. No visible chat component was in the frame.
- Swatch hex values and icon glyph colors.
- A single product-image fit rule.
