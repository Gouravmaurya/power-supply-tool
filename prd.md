# Role & System Instruction
You are an expert Senior Full-Stack Engineer specializing in Next.js (App Router), Tailwind CSS, and the Supabase JavaScript SDK ecosystem. Your task is to architect and generate a clean, modern, single-page internal utility application based on the Product Requirement Document (PRD) below. 

Prioritize extreme code execution security, atomic UI/UX styling matching high-end premium SaaS tools, and fully typed TypeScript connections.

---

## 1. Product Overview & Context
- **Product Name:** VoltTrack (Power Supply Field Manager)
- **Target Audience:** Internal field worker utility tool (Personal use application).
- **Core Intent:** A fast, high-contrast, frictionless interface allowing a field worker to log electricity meter installations or updates while on-site, upload proof imagery, and run instant, client-side global searches over records.

---

## 2. Technical Stack Specifications
- **Framework:** Next.js 14+ (App Router, React Server Components where applicable, Client Components for dynamic forms).
- **Styling:** Tailwind CSS (Clean borders, sharp typography, premium high-contrast monochrome design system).
- **Database & Storage Backend:** Supabase (PostgreSQL engine via Supabase client SDK).
- **Icons:** Lucide React (for search, upload, layout identifiers).

---

## 3. Database & Storage Architecture Requirements

Execute database configuration expectations matching this strict relational setup via Supabase:

### Table: `meter_logs`
- `id`: uuid (Primary Key, default: `gen_random_uuid()`)
- `consumer_name`: text (Not Null)
- `address`: text (Not Null)
- `meter_number`: text (Not Null)
- `meter_reading`: float8 (Not Null)
- `image_url`: text (Nullable - stores the public asset cloud bucket reference link)
- `notes`: text (Nullable)
- `created_at`: timestamp with time zone (default: `now()`)

### Storage Bucket
- **Bucket Name:** `meter-images`
- **Access Level:** Public read access enabled.

---

## 4. Feature Specifications & User Experience Flow

### A. The Structural Entry Layout (Left Rail / Form Grid)
- Build a clean inputs segment containing validation handlers for creating new logs.
- Field constraints:
  - Consumer Name: Standard clean text text input.
  - Address: Textarea handling multi-line inputs with auto-resize prevention.
  - Meter Number: Alpha-numeric entry validation.
  - Meter Reading: Float step verification parsing to floating-point standards safely.
  - Upload Area: A modern drag-and-drop file block handling image filters (`image/*`).
  - Notes: Optional observation field.
- Visual state handler: Implement loading skeleton block buttons when `isSubmitting` is flagged true during transmission states.

### B. Instant Live Query Matching (Right Rail / Content List)
- Implement a singular global search box text panel.
- **Search Intent Query Logic:** Real-time client-side array matching execution. The string argument passed must concurrently isolate and filter array objects matching against EITHER `consumer_name` OR `address` matching indices using an insensitive `.includes()` paradigm.
- Performance optimization: Isolate filtering executions wrapped cleanly inside an optimized React `useMemo` dependency array hooks layer.

### C. Image Upload Pipeline Sequence
- Catch file stream triggers. Generate a collision-resistant filename prefix (`Date.now() + random_suffix`).
- Use the Supabase storage SDK engine to upload file binaries up to the public `meter-images` container path.
- Extract the public URL string context immediately upon safe resolution and bind it directly to the structural JSON database row record creation transaction context payload.

---

## 5. Directory Setup Guidelines
Generate the code structuring elements neatly along these specific layout vectors:

1. `lib/supabase.ts` -> Handle connection orchestration instances referencing standard environmental setup mappings:
   - `process.env.NEXT_PUBLIC_SUPABASE_URL`
   - `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. `app/page.tsx` -> The core client interface dashboard managing state synchronization mechanics, layout blocks, styling patterns, visual indicators, and mutation actions seamlessly.
3. `next.config.js` -> Remote asset optimization permissions mapped against the storage hostname subdomain variables (`*.supabase.co`).

---

## Execution Command
Please analyze the complete scope detailed above and generate the unified layout component structures using optimal architecture patterns. Ensure all files are generated without omitting sections or using placeholder comments.