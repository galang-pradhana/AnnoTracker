// Script: create-assessment-tables.mjs
// Run: node scratch/create-assessment-tables.mjs
// Creates assessment tables using Supabase pg REST

import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function runSQL(sql) {
  const projectRef = url.replace('https://', '').replace('.supabase.co', '');
  const mgmtUrl = `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`;
  
  // Try via pg endpoint if available
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { 
      'apikey': key, 
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log("REST status:", res.status);
}

// Instead use supabase-js with direct query approach
const supabase = createClient(url, key, { auth: { persistSession: false } });

const PR_FORM_TEMPLATE = {
  questions: [
    {
      id: "q1",
      text: "Does the response follow the user's instructions?",
      type: "radio",
      options: [
        { value: "a", label: "a. Not following" },
        { value: "b", label: "b. Partially following" },
        { value: "c", label: "c. Fully following" },
      ],
      required: true,
    },
    {
      id: "q2",
      text: "Are there any localization issues in the response?",
      type: "radio_conditional",
      options: [
        {
          value: "yes",
          label: "a. Yes (issues present)",
          conditional: {
            type: "multi_select_and_text",
            subQuestion: "Which localization issues are present? Select all that apply.",
            checkboxes: [
              "Unlocalized information",
              "Overly-localized content",
              "Spelling",
              "Tone",
              "Non-local perspective",
              "Vocabulary",
              "Awkward or unnatural writing",
              "Formatting & punctuation",
              "Grammar",
              "Phrase or idiom",
              "Units of measurement",
              "Wrong language",
              "Other",
            ],
            textLabel: "Jelaskan pilihanmu berdasarkan guideline {{TARGET_LANGUAGE}}.",
          }
        },
        { value: "no", label: "b. No (no issues)" },
      ],
      required: true,
    },
    {
      id: "q3",
      text: "How concise is the response?",
      type: "radio_conditional",
      options: [
        { value: "a", label: "a. Bad",
          conditional: {
            type: "radio",
            subQuestion: "How would you describe the response?",
            subOptions: [
              { value: "shorter", label: "a. It could have been made shorter" },
              { value: "longer", label: "b. It could have been made longer" },
            ]
          }
        },
        { value: "b", label: "b. Acceptable",
          conditional: {
            type: "radio",
            subQuestion: "How would you describe the response?",
            subOptions: [
              { value: "shorter", label: "a. It could have been made shorter" },
              { value: "longer", label: "b. It could have been made longer" },
            ]
          }
        },
        { value: "c", label: "c. Good" },
      ],
      required: true,
    },
    {
      id: "q4",
      text: "How truthful is the response?",
      type: "radio",
      options: [
        { value: "a", label: "a. Not Truthful" },
        { value: "b", label: "b. Partially Truthful" },
        { value: "c", label: "c. Truthful" },
      ],
      required: true,
    },
    {
      id: "q5",
      text: "How satisfying is the response?",
      type: "radio",
      options: [
        { value: "a", label: "a. ☹️😔 Highly Unsatisfying" },
        { value: "b", label: "b. 🤨 Slightly Unsatisfying" },
        { value: "c", label: "c. 🙂 Slightly Satisfying" },
        { value: "d", label: "d. 😍 Highly Satisfying" },
      ],
      required: true,
    },
  ],
  justification: {
    label: "Please describe the reasons for your gradings",
    description: "(satu rangkuman utama untuk keseluruhan hasil jawabanmu dalam satu paragraf padat dan jelas, dalam bahasa Indonesia DAN bahasa Inggris)",
    required: true,
  },
  responseLabels: ["A", "B", "C"],
};

async function createTables() {
  console.log("🛠 Creating assessment tables via Supabase Management API...\n");

  const projectRef = url.replace('https://', '').split('.')[0];
  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  const sql = `
    CREATE TABLE IF NOT EXISTS public.assessment_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      task_type TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'closed')),
      form_template JSONB NOT NULL DEFAULT '{}',
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS public.assessment_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES public.assessment_tasks(id) ON DELETE CASCADE,
      item_number INTEGER NOT NULL,
      user_request TEXT NOT NULL,
      responses JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS public.assessment_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES public.assessment_tasks(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      answers JSONB NOT NULL DEFAULT '{}',
      justification_id TEXT,
      justification_en TEXT,
      score NUMERIC(5,2),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
      submitted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    ALTER TABLE public.assessment_tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Anyone auth can read tasks" ON public.assessment_tasks;
    CREATE POLICY "Anyone auth can read tasks" ON public.assessment_tasks
      FOR SELECT USING (auth.uid() IS NOT NULL);
    
    DROP POLICY IF EXISTS "Owners manage tasks" ON public.assessment_tasks;
    CREATE POLICY "Owners manage tasks" ON public.assessment_tasks
      FOR ALL USING (public.is_owner());
    
    DROP POLICY IF EXISTS "Anyone auth can read items" ON public.assessment_items;
    CREATE POLICY "Anyone auth can read items" ON public.assessment_items
      FOR SELECT USING (auth.uid() IS NOT NULL);
    
    DROP POLICY IF EXISTS "Owners manage items" ON public.assessment_items;
    CREATE POLICY "Owners manage items" ON public.assessment_items
      FOR ALL USING (public.is_owner());
    
    DROP POLICY IF EXISTS "Users manage own submissions" ON public.assessment_submissions;
    CREATE POLICY "Users manage own submissions" ON public.assessment_submissions
      FOR ALL USING (auth.uid() = user_id OR public.is_owner());
  `;
  
  const serviceToken = process.env.SUPABASE_ACCESS_TOKEN;
  
  if (serviceToken) {
    const res = await fetch(mgmtUrl, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    const data = await res.json();
    console.log("Management API response:", res.status, JSON.stringify(data).slice(0, 200));
  } else {
    console.log("No SUPABASE_ACCESS_TOKEN. Trying direct pg...");
    console.log("Please run this SQL manually in your Supabase SQL Editor:");
    console.log("\n--- START SQL ---\n");
    console.log(sql);
    console.log("\n--- END SQL ---\n");
    console.log("Then re-run this script to seed data.");
  }
}

async function seedData() {
  console.log("\n📊 Checking if tables exist...");
  const { data: test, error: testErr } = await supabase.from('assessment_tasks').select('id').limit(1);
  
  if (testErr && testErr.code === 'PGRST205') {
    console.error("❌ Tables don't exist yet. Please run the SQL migration first.");
    console.log("\n🔗 Go to: https://supabase.com/dashboard/project/gdqpfxbowtebkghfkpxn/sql/new");
    console.log("📋 Then paste the contents of: supabase/migrations/003_assessment_schema.sql");
    return false;
  }
  
  console.log("✅ Tables exist! Seeding data...\n");

  const task = {
    title: "Kualifikasi Anotator — Task PR (Proofreading & Evaluation)",
    task_type: "PR",
    description: "Tes evaluasi awal untuk memastikan karyawan memahami cara memberikan rating pada response AI berdasarkan kriteria localization, conciseness, truthfulness, dan satisfaction sesuai guideline.",
    status: "active",
    form_template: PR_FORM_TEMPLATE,
  };

  // Check if task already exists
  const { data: existing } = await supabase
    .from('assessment_tasks')
    .select('id')
    .eq('title', task.title)
    .maybeSingle();

  let taskId;
  
  if (existing) {
    console.log("✅ Task already exists:", existing.id);
    taskId = existing.id;
    await supabase.from('assessment_items').delete().eq('task_id', taskId);
  } else {
    const { data: inserted, error } = await supabase.from('assessment_tasks').insert(task).select().single();
    if (error) {
      console.error("❌ Task insert error:", error);
      return false;
    }
    taskId = inserted.id;
    console.log("✅ Task created:", taskId);
  }

  const items = [
    {
      task_id: taskId,
      item_number: 1,
      user_request: `I work in a travel agency, and my current task is to come up with a photo caption for an advertisement to attract more people to visit Yala province. Please write the ad photo caption for me. The caption must be about inviting people from other provinces in Thailand to visit Yala, mentioning the advantages of Yala province and other tourism promotion information. I'd like exactly 5 lines, but the content must be comprehensive and concise.`,
      responses: {
        A: `Open up a new experience with Yala, a place full of diverse cultures and stunning nature. Experience the charm of cave waterfalls, ancient temples, and delicious, mouth-watering local food. Whether it's an adventure in the mountains or relaxing by the sea, Yala is ready to welcome you with unforgettable warmth and impressions. Come explore and create lasting memories with us today!`,
        B: `Yala... The destination waiting for you! Inviting Thais nationwide to experience the beauty of its diverse nature and culture.\n\nExperience the fresh air and peaceful atmosphere, perfect for true relaxation in Yala province.\n\nTravel safely with complete facilities, alongside warm service from the locals.\n\nJoin in experiencing history and exciting cultural activities in the unique areas of Yala.\n\nCome visit Yala today... A worthwhile new experience for everyone across Thailand!`,
        C: `Calling everyone across Thailand to experience the charm of Yala province!\nA province endowed with beautiful nature and diverse cultures.\nFeel the warmth of the local community and taste the delicious local dishes.\nUnlock new and unique experiences in Yala province.\nCome visit Yala for a truly memorable adventure!`,
      }
    },
    {
      task_id: taskId,
      item_number: 2,
      user_request: `which of these artists could be included in an essay about 20th century artists?\n\nPablo Picasso\nFrida Kahlo\nAndy Warhol\nGeorgia O'Keeffe\nMichelangelo\nSalvador Dalí\nJackson Pollock\nHenri Matisse\nRené Magritte\nEugène Delacroix\nEdvard Munch`,
      responses: {
        A: `Okay, let's break down which of those artists would be a good fit for an essay about 20th-century artists.\n\nDefinitely Included (Strong Choices):\n\nPablo Picasso: Absolutely essential. He was a hugely influential figure throughout the entire 20th century, pioneering Cubism and constantly experimenting.\nFrida Kahlo: A major figure in the mid-20th century, known for her intensely personal and symbolic self-portraits.\nAndy Warhol: A cornerstone of Pop Art, representing the shift in art towards consumerism and mass culture.\nGeorgia O'Keeffe: A significant figure in American Modernism, particularly known for her large-scale paintings of flowers and Southwestern landscapes.\nJackson Pollock: A key figure in Abstract Expressionism, revolutionizing painting with his drip technique.\nSalvador Dalí: A prominent Surrealist, known for his dreamlike imagery and bizarre juxtapositions.\n\nGood Choices – Depending on the Essay's Focus:\n\nHenri Matisse: While much of his important work was before the 20th century, his Fauvist style significantly influenced the early 20th century.\n\nNot Included (Primarily Pre-20th Century):\n\nMichelangelo: A High Renaissance master (1475-1564).\nEugène Delacroix: A key Romantic painter (1798-1863).\nEdvard Munch: A Norwegian Expressionist (1863-1944), but his most influential work was created in the late 19th and early 20th centuries.`,
        B: `For an essay about 20th-century artists, you could include the following artists:\n\nPablo Picasso\nFrida Kahlo\nAndy Warhol\nGeorgia O'Keeffe\nSalvador Dalí\nJackson Pollock\nHenri Matisse\nRené Magritte\nEdvard Munch\n\nMichelangelo and Eugène Delacroix are primarily associated with the 16th and 19th centuries, respectively, so they would not be appropriate for this essay focused on 20th-century artists.`,
        C: `For an essay about 20th-century artists, you would include the following individuals from your list:\n\nPablo Picasso - Known for his significant contributions to modern art, including Cubism, which emerged in the early 20th century.\n\nFrida Kahlo - A prominent figure in 20th-century art, recognized for her deeply personal and symbolic self-portraits.\n\nAndy Warhol - A key figure in the Pop Art movement, which became prominent in the mid-20th century.\n\nGeorgia O'Keeffe - Although her work gained prominence later, her unique style and focus on American landscapes were influential in the 20th century.\n\nSalvador Dalí - Known for his surrealist works, which were highly influential throughout the 20th century.\n\nJackson Pollock - Central to the Abstract Expressionism movement, a dominant force in 20th-century art.\n\nHenri Matisse - His work transitioned from Symbolism to Fauvism and continued to influence 20th-century art.\n\nRené Magritte - A leading figure in Surrealism, whose work significantly impacted the 20th century.\n\nArtists like Michelangelo, Eugène Delacroix, and Edvard Munch are primarily associated with the 19th century, though their influence extended into the 20th century.`,
      }
    }
  ];

  for (const item of items) {
    const { data, error } = await supabase.from('assessment_items').insert(item).select().single();
    if (error) {
      console.error(`  ❌ Item ${item.item_number} failed:`, error.message);
    } else {
      console.log(`  ✅ Item ${item.item_number} inserted:`, data.id);
    }
  }

  console.log("\n🎉 Assessment seeding complete!");
  console.log(`Task ID: ${taskId}`);
  return true;
}

async function main() {
  await createTables();
  await seedData();
}

main().catch(console.error);
