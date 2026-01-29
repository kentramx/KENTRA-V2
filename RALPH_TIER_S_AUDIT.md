# RALPH LOOP: Tier S Enterprise Audit for Kentra

You are auditing and upgrading the Kentra real estate portal to **Tier S enterprise quality** (Stripe/Linear/Vercel level).

## CRITICAL RULES
1. Make REAL changes to files - don't just describe what to do
2. Focus on ONE component/area per iteration
3. After each fix, verify it works
4. Track progress in this file by checking off items
5. When ALL items are checked and verified, output: `<promise>TIER_S_COMPLETE</promise>`

## Current Tech Stack
- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand for state
- React Query for data fetching

## Tier S Checklist

### Phase 1: Design Tokens & Foundation
- [ ] Audit tailwind.config.ts - verify 8px grid spacing scale
- [ ] Audit src/index.css - check CSS variables consistency
- [ ] Verify color contrast meets WCAG AAA
- [ ] Check font scale hierarchy (display, h1-h6, body, caption)
- [ ] Ensure consistent border-radius tokens

### Phase 2: Core Components Polish
- [ ] Button - hover/active states with transform scale(0.98)
- [ ] Button - loading state with spinner
- [ ] Input - focus ring animation
- [ ] Input - error state styling
- [ ] Card - hover elevation shadow transition
- [ ] Badge - consistent sizing
- [ ] Avatar - loading skeleton
- [ ] Dropdown/Select - smooth open animation

### Phase 3: Layout & Spacing
- [ ] Navbar - proper height, shadow on scroll
- [ ] Footer - balanced spacing, proper hierarchy
- [ ] Page containers - consistent max-width and padding
- [ ] Section spacing - proper breathing room (py-16 md:py-24)
- [ ] Grid gaps - consistent spacing

### Phase 4: Property Components
- [ ] PropertyCard - image loading skeleton
- [ ] PropertyCard - hover state elevation
- [ ] PropertyCard - price formatting polished
- [ ] PropertyCard - badge positioning
- [ ] PropertyDetail - hero image gallery smooth
- [ ] PropertyDetail - info sections spacing

### Phase 5: Forms & Inputs
- [ ] Form labels - proper spacing and typography
- [ ] Validation errors - smooth appearance animation
- [ ] Submit buttons - loading state
- [ ] Input groups - proper alignment
- [ ] Checkbox/Radio - custom styled consistently

### Phase 6: Feedback & States
- [ ] Toast notifications - enter/exit animations
- [ ] Empty states - illustrated and helpful
- [ ] Error states - friendly messaging
- [ ] Loading skeletons - shimmer effect
- [ ] 404 page - designed and helpful

### Phase 7: Micro-interactions
- [ ] Page transitions - subtle fade
- [ ] List item stagger animations
- [ ] Button ripple or scale effect
- [ ] Link hover underline animation
- [ ] Image zoom on hover (galleries)

### Phase 8: Performance & Polish
- [ ] No Cumulative Layout Shift (CLS)
- [ ] Images have aspect-ratio set
- [ ] Lazy loading for below-fold images
- [ ] Smooth scrolling enabled
- [ ] Focus visible states for accessibility

## Current Progress
Iteration: 7
Last action: Redesigned NotFound page to Tier S, created EmptyState component
Next action: Continue with form validation, loading states, micro-interactions

### Completed Items:
- [x] tailwind.config.ts - Added typography scale, 8px spacing, shadows, transitions
- [x] Button - Added loading state, variants (success, premium), sizes (xs, xl)
- [x] Card - Added variants (elevated, outlined, ghost, interactive)
- [x] Input - Added variants (error, success, ghost), sizes
- [x] Skeleton - Added shimmer effect, preset shapes
- [x] Sonner/Toast - Added rich colors, better styling, positioning
- [x] NotFound page - Completely redesigned with animation, gradient, actions
- [x] EmptyState component - Created reusable component with presets

## Instructions for This Iteration
1. Read the checklist above
2. Find the FIRST unchecked item
3. Audit the relevant files
4. Make the necessary changes to achieve Tier S quality
5. Mark the item as checked [x]
6. Update "Current Progress" section
7. If ALL items checked, output: `<promise>TIER_S_COMPLETE</promise>`

START NOW - Pick the first unchecked item and fix it.
