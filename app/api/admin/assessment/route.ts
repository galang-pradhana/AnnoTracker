import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SECRET_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const MIGRATION_SQL = `
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
ALTER TABLE public.assessment_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_tasks' AND policyname = 'Anyone auth can read tasks') THEN
    CREATE POLICY "Anyone auth can read tasks" ON public.assessment_tasks FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_tasks' AND policyname = 'Owners manage tasks') THEN
    CREATE POLICY "Owners manage tasks" ON public.assessment_tasks FOR ALL USING (public.is_owner());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_items' AND policyname = 'Anyone auth can read items') THEN
    CREATE POLICY "Anyone auth can read items" ON public.assessment_items FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_items' AND policyname = 'Owners manage items') THEN
    CREATE POLICY "Owners manage items" ON public.assessment_items FOR ALL USING (public.is_owner());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_submissions' AND policyname = 'Users manage own submissions') THEN
    CREATE POLICY "Users manage own submissions" ON public.assessment_submissions FOR ALL USING (auth.uid() = user_id OR public.is_owner());
  END IF;
END $$;
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;
    const admin = getAdminClient();

    if (action === "run_migration") {
      // Use pg to run the migration via supabase connection
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const projectRef = url.replace("https://", "").split(".")[0];
      const key = process.env.SUPABASE_SECRET_KEY!;

      // Try Supabase Management API
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: MIGRATION_SQL }),
        }
      );
      const data = await res.json();

      if (res.ok) {
        return NextResponse.json({ success: true, message: "Migration berhasil dijalankan!" });
      }

      // If management API fails, return the SQL for manual execution
      return NextResponse.json({
        success: false,
        requiresManual: true,
        sql: MIGRATION_SQL,
        message: data.message || "Jalankan SQL secara manual di Supabase Dashboard",
      });
    }

    if (action === "seed_pr_task") {
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
                    "Unlocalized information","Overly-localized content","Spelling","Tone",
                    "Non-local perspective","Vocabulary","Awkward or unnatural writing",
                    "Formatting & punctuation","Grammar","Phrase or idiom",
                    "Units of measurement","Wrong language","Other",
                  ],
                  textLabel: "Jelaskan pilihanmu berdasarkan guideline {{TARGET_LANGUAGE}}.",
                },
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
              {
                value: "a", label: "a. Bad",
                conditional: {
                  type: "radio",
                  subQuestion: "How would you describe the response?",
                  subOptions: [
                    { value: "shorter", label: "a. It could have been made shorter" },
                    { value: "longer", label: "b. It could have been made longer" },
                  ],
                },
              },
              {
                value: "b", label: "b. Acceptable",
                conditional: {
                  type: "radio",
                  subQuestion: "How would you describe the response?",
                  subOptions: [
                    { value: "shorter", label: "a. It could have been made shorter" },
                    { value: "longer", label: "b. It could have been made longer" },
                  ],
                },
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
          label: "Overall Final Justification / Comments",
          description: "Rangkuman & justifikasi akhir dari keseluruhan pengerjaan task ini (wajib diisi dalam Bahasa Indonesia dan English)",
          required: true,
        },
        responseLabels: ["A", "B", "C"],
        comparisonPairs: [
          { id: "A_B", left: "A", right: "B", label: "Comparasi Response A vs Response B" },
          { id: "A_C", left: "A", right: "C", label: "Comparasi Response A vs Response C" },
          { id: "B_C", left: "B", right: "C", label: "Comparasi Response B vs Response C" },
        ],
        comparisonOptions: [
          { value: "left_much", label: "Left Much Better" },
          { value: "left_better", label: "Left Better" },
          { value: "left_slightly", label: "Left Slightly Better" },
          { value: "same", label: "Same" },
          { value: "right_slightly", label: "Right Slightly Better" },
          { value: "right_better", label: "Right Better" },
          { value: "right_much", label: "Right Much Better" },
        ],
      };

      const existingTasks = await admin
        .from("assessment_tasks")
        .select("id")
        .eq("task_type", "PR")
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingTasks.error?.code === "PGRST205") {
        return NextResponse.json({
          success: false,
          requiresManual: true,
          sql: MIGRATION_SQL,
          message: "Tabel belum ada. Jalankan migration SQL dulu.",
        });
      }

      let taskId: string;
      if (existingTasks.data && existingTasks.data.length > 0) {
        taskId = existingTasks.data[0].id;
      } else {
        const { data: newTask, error: taskErr } = await admin
          .from("assessment_tasks")
          .insert({
            title: "Kualifikasi Anotator — Task PR (Proofreading & Evaluation)",
            task_type: "PR",
            description: "Tes evaluasi untuk memastikan karyawan memahami cara rating response AI berdasarkan kriteria localization, conciseness, truthfulness, dan satisfaction.",
            status: "active",
            form_template: PR_FORM_TEMPLATE,
          })
          .select()
          .single();
        if (taskErr) throw taskErr;
        taskId = newTask.id;
      }

      // Delete existing items
      await admin.from("assessment_items").delete().eq("task_id", taskId);

      // Insert items
      const items = [
        {
          task_id: taskId,
          item_number: 1,
          user_request: "I work in a travel agency, and my current task is to come up with a photo caption for an advertisement to attract more people to visit Yala province. Please write the ad photo caption for me. The caption must be about inviting people from other provinces in Thailand to visit Yala, mentioning the advantages of Yala province and other tourism promotion information. I'd like exactly 5 lines, but the content must be comprehensive and concise.",
          responses: {
            A: "Open up a new experience with Yala, a place full of diverse cultures and stunning nature. Experience the charm of cave waterfalls, ancient temples, and delicious, mouth-watering local food. Whether it's an adventure in the mountains or relaxing by the sea, Yala is ready to welcome you with unforgettable warmth and impressions. Come explore and create lasting memories with us today!",
            B: "Yala... The destination waiting for you! Inviting Thais nationwide to experience the beauty of its diverse nature and culture.\n\nExperience the fresh air and peaceful atmosphere, perfect for true relaxation in Yala province.\n\nTravel safely with complete facilities, alongside warm service from the locals.\n\nJoin in experiencing history and exciting cultural activities in the unique areas of Yala.\n\nCome visit Yala today... A worthwhile new experience for everyone across Thailand!",
            C: "Calling everyone across Thailand to experience the charm of Yala province!\nA province endowed with beautiful nature and diverse cultures.\nFeel the warmth of the local community and taste the delicious local dishes.\nUnlock new and unique experiences in Yala province.\nCome visit Yala for a truly memorable adventure!",
          },
        },
        {
          task_id: taskId,
          item_number: 2,
          user_request: "which of these artists could be included in an essay about 20th century artists?\n\nPablo Picasso\nFrida Kahlo\nAndy Warhol\nGeorgia O'Keeffe\nMichelangelo\nSalvador Dalí\nJackson Pollock\nHenri Matisse\nRené Magritte\nEugène Delacroix\nEdvard Munch",
          responses: {
            A: "Okay, let's break down which of those artists would be a good fit for an essay about 20th-century artists.\n\nDefinitely Included (Strong Choices):\n• Pablo Picasso: Absolutely essential. Pioneer of Cubism.\n• Frida Kahlo: Major figure in mid-20th century, symbolic self-portraits.\n• Andy Warhol: Cornerstone of Pop Art.\n• Georgia O'Keeffe: Significant in American Modernism.\n• Jackson Pollock: Key in Abstract Expressionism.\n• Salvador Dalí: Prominent Surrealist.\n\nGood Choices:\n• Henri Matisse: Fauvist style influenced early 20th century.\n\nNot Included (Pre-20th Century):\n• Michelangelo (1475-1564)\n• Eugène Delacroix (1798-1863)\n• Edvard Munch: Bridge between 19th and 20th centuries.\n\nCould you tell me more about the essay's focus and scope?",
            B: "For an essay about 20th-century artists, you could include the following artists:\n\nPablo Picasso\nFrida Kahlo\nAndy Warhol\nGeorgia O'Keeffe\nSalvador Dalí\nJackson Pollock\nHenri Matisse\nRené Magritte\nEdvard Munch\n\nMichelangelo and Eugène Delacroix are primarily associated with the 16th and 19th centuries, respectively, so they would not be appropriate for this essay.",
            C: "For an essay about 20th-century artists, you would include:\n\nPablo Picasso - Significant contributions to modern art, including Cubism.\nFrida Kahlo - Recognized for deeply personal and symbolic self-portraits.\nAndy Warhol - Key figure in the Pop Art movement.\nGeorgia O'Keeffe - Unique style and focus on American landscapes.\nSalvador Dalí - Known for surrealist works.\nJackson Pollock - Central to Abstract Expressionism.\nHenri Matisse - Transitioned from Fauvism and influenced 20th century art.\nRené Magritte - Leading figure in Surrealism.\n\nArtists like Michelangelo, Eugène Delacroix, and Edvard Munch are primarily associated with earlier periods.",
          },
        },
        {
          task_id: taskId,
          item_number: 3,
          user_request: "I am planning to open a cake shop and looking for a creative name. this name should based on some sweet food. I live in India hence the shop name should be suggested accordingly. also to be noted that the suggested name should not start from letters R,K,T,N. give me 10 suggestions please.",
          responses: {
            A: "That sounds like a delightful venture! Here are ten creative cake shop name suggestions inspired by sweet foods, tailored for your Indian market and avoiding the letters you specified:\n\nMithai Morsels\nGulab Delight\nLadoo Layers\nRasmalai Reverie\nKaju Kheer Kitchen\nChakra Choco Corner\nPeda Pastries\nJalebi Junction\nBesan Bliss\nSandesh Sweets\n\nI hope these inspire you in finding the perfect name for your cake shop!",
            B: "Congratulations on your new venture! Here are ten creative cake shop name suggestions inspired by sweet foods, tailored for your Indian location, and avoiding the specified letters:\n\nChocoCharm\nSweetSwirls\nDessertDusk\nSugarSerenade\nFlourFusion\nCandyCove\nPastryPalette\nSugarSprout\nConfectionCraze\nMeltMagic\n\nThese names aim to capture the essence of sweetness while resonating with your local market.",
            C: "Okay, let’s brainstorm some creative cake shop names based on sweet Indian foods, avoiding R, K, T, and N! Here are 10 suggestions, with a little explanation of the inspiration behind each:\n\nGulab Bliss: \"Gulab\" refers to Gulab Jamun, a classic Indian sweet, and \"Bliss\" evokes the joy of eating cake. It’s warm, inviting, and instantly recognizable.\nJalebi Joy: Similar to the above, “Jalebi” is another hugely popular Indian sweet known for its swirls and caramel flavor. “Joy” adds a positive feeling.\nBarfi Bites: “Barfi” is a rich, milk-based sweet. \"Bites\" suggests smaller, manageable cakes and treats.\nChocolat Chaat: A playful combination! \"Chaat\" is a popular Indian savory snack, and pairing it with “Chocolat” hints at decadent chocolate cakes.\nKheer Dreams: “Kheer” is a rice pudding, a beloved dessert. \"Dreams\" suggests the delightful experience of enjoying a cake.\nRasgulla Rose: \"Rasgulla\" is a spongy, syrupy ball, and “Rose” adds a touch of elegance and floral fragrance, often found in Indian desserts.\nSaffron Sugar: “Saffron” is a precious spice used in many Indian sweets, and \"Sugar\" clearly indicates the focus on sweetness. It sounds sophisticated.\nHalwa Haven: “Halwa” is a rich, dense pudding. \"Haven\" suggests a safe and delightful place to indulge.\nMango Muse: \"Mango\" is a hugely popular fruit in India, and “Muse” implies inspiration and creativity in your baking.\nPeda Paradise: “Peda” is a dense, crumbly milk-based sweet. \"Paradise\" promises a truly delightful experience.\n\nTo help me narrow it down and give you even more tailored suggestions, could you tell me:\n\nWhat kind of cakes will you specialize in? (e.g., traditional Indian flavors, fusion cakes, classic Western cakes, vegan options?)\nWhat’s the overall vibe you're going for? (e.g., rustic and charming, modern and chic, playful and colorful?)",
          },
        },
        {
          task_id: taskId,
          item_number: 4,
          user_request: "Rewrite the following text in contemporary speech without using any slang or Gen Z vernacular: \"Tell me, O Muse, of the man of many devices, who wandered full many ways after he had sacked the sacred citadel of Troy. Many were the men whose cities he saw and whose mind he learned, aye, and many the woes he suffered in his heart upon the sea, seeking to win his own life and the return of his comrades.\". Then create the first story beat entry of what you've rewritten at the end of the text.",
          responses: {
            A: "Please, Muse, recount the tale of the resourceful man who journeyed far and wide after the fall of the sacred city of Troy. He encountered numerous cities and learned from their people, but he also endured many hardships at sea, striving to survive and reunite with his fellow travelers.\n\nStory Beat Entry:\n\nThe sun dipped below the horizon, casting long shadows over the restless sea. Odysseus stood at the helm of his battered ship, his eyes scanning the endless expanse for any sign of hope or danger. The remnants of Troy lay behind him, a distant memory that weighed heavily on his heart. As the waves crashed against the hull, he resolved to press on, knowing that every challenge he faced brought him closer to the safety of his homeland and the reunion with his beloved family.",
            B: "Okay, here’s a rewrite of the text in contemporary speech, avoiding slang and Gen Z terms:\n\n“Listen, I want to hear about this guy – a really complicated one. After he took Troy, he just kept traveling, going everywhere. He saw so many different cities and met so many people, learning about their lives. And, honestly, he went through a lot of hardship, a lot of sadness, especially on the sea. He was desperately trying to survive and bring his friends home.”\n\nFirst Story Beat Entry:\n\nBeat 1: The rain hammered against the bronze roof of the longship, a relentless, grey drumming that mirrored the ache in Odysseus’s chest. Salt spray stung his face, blurring the already indistinct outline of the storm-wracked horizon. He gripped the tiller, his knuckles white, and stared out into the churning blackness. Three years. Three years since the fall of Troy, three years since he’d last seen the faces of his men, three years of a journey fueled by a single, consuming obsession: to return home. The wind howled a mournful song, a constant reminder of the ghosts he carried with him – the fallen warriors, the lost comrades, and the crushing weight of his own impossible task. He tasted blood, not from a wound, but from the bitter tang of regret. He was a man forged in battle, yes, but tonight, he felt like a broken thing, adrift on a sea of sorrow.",
            C: "Tell me, Muse, about the clever man who traveled extensively after he destroyed the sacred city of Troy. He visited numerous cities and gained a wealth of knowledge, yet he endured many hardships at sea, constantly striving to survive and bring his fellow travelers home.\n\nStory Beat Entry:\n\nIntroduction of Odysseus: Clever man who embarks on a perilous journey after the fall of Troy, seeking survival and reunion with his companions.",
          },
        },
        {
          task_id: taskId,
          item_number: 5,
          user_request: "Give me some business ideas for a 10-year-old with $150 of startup money. This should be within reason for a 10-year-old to complete on their own. Make at least half of the ideas funny and that a 10-year-old would enjoy doing. Present it in the voice of a character the kids will know and listen to.",
          responses: {
            A: "Okay, hey there, future entrepreneurs! It’s Agent Sparkle here, your official guide to turning those pennies into…well, a lot of pennies!  I’ve been tracking the coolest kids in the world and I’ve got some seriously awesome business ideas for you, all with a budget of $150. Let’s do this! \n(Agent Sparkle adjusts a sparkly headset and beams)\n\n1. Personalized Sticker Squad (Seriously Fun!)\n\nThe Idea: Everyone loves stickers! You create custom sticker sheets with inside jokes, drawings of their favorite characters, or even little motivational messages.\nStartup Cost: $30-50 for sticker paper, markers, and maybe a small laminator (you can find cheap ones online!).\nHow it Works: Ask friends, neighbors, and family what they'd want on their sheets. Design them, print, and sell them for $2-5 each.\nAgent Sparkle Says: “This is totally you! You get to be creative and make people smile. Plus, imagine the epic sticker sheets you’ll design!”\n\n2. Miniature Monster Mailer Service (A Little Spooky, A Lot Cute!)\n\nThe Idea: Create tiny, adorable monster mailers! You design and make little monster characters (think fluffy, silly monsters, not scary ones!) and package them with a handwritten note.\nStartup Cost: $60-80 for felt, googly eyes, pipe cleaners, glue, small envelopes, and maybe some glitter (because sparkle!).\nHow it Works: Offer to deliver these little monsters to friends and family. Charge $3-5 per mailer.\nAgent Sparkle Says: “These are seriously adorable! You’ll be a tiny monster messenger – how cool is that?”\n\n3. Backyard Bug Observation Station (For the Nature Nerds!)\n\nThe Idea: Lots of kids are curious about bugs! You set up a simple observation station in your backyard – a small jar with a magnifying glass, a notebook for recording observations, and maybe a little sign.\nStartup Cost: $40-60 for a small jar, magnifying glass, notebook, pencils, and a small sign made from cardboard.\nHow it Works: Charge a small fee (like $1-2) for kids to come and observe bugs with you. You could even create little \"bug fact sheets\" to sell.\nAgent Sparkle Says: “You’re a bug detective! This is perfect if you love exploring the outdoors and learning about creepy crawlies.”\n\n4. Lemonade Stand 2.0: The Themed Stand (Let's Get Fancy!)\n\nThe Idea: Don’t just do a regular lemonade stand! Pick a theme – Pirate Lemonade, Superhero Lemonade, Rainbow Lemonade – and decorate accordingly.\nStartup Cost: $50-70 for decorations (streamers, tablecloths, themed signs), cups, ice, and lemons.\nHow it Works: Charge a little more for your themed lemonade ($2-3 a cup).\nAgent Sparkle Says: “This is a classic, but with a sparkle twist! People love a good theme!”\n\n5. Lost Toy Finder (Helping People, Getting Paid!)\n\nThe Idea: Offer to help people find lost toys in your neighborhood. You could put up flyers or ask neighbors if they’d like your help.\nStartup Cost: $20-40 for printing flyers and maybe some small prizes for finding toys (stickers, small candies).\nHow it Works: Charge a small fee (like $5-10) for your services.\nAgent Sparkle Says: “You’re a neighborhood hero! This is a super helpful and rewarding business.”\n\n6.  Crazy Sock Sorting Service (A Hilarious Task!)\n\nThe Idea: Let's be honest, nobody likes sorting socks. You offer to sort through people’s messy sock drawers and organize them into color-coded piles.\nStartup Cost: $10-20 for a few colorful rubber bands or clips to help with organization.\nHow it Works: Charge $10-20 for a sock sorting session.\nAgent Sparkle Says: \"This is the weirdest, most brilliant idea! You're basically a sock wizard. Plus, you’ll be saving people hours of frustration.\"\n\nImportant Agent Sparkle Tips:\n\nTalk to Your Parents: Make sure your parents are on board and can help you with anything you need.\nStart Small: Don't try to do everything at once. Pick one idea and focus on making it awesome.\nBe Friendly: A smile and a good attitude go a long way!\nHave Fun! If you're not enjoying it, it's not worth it.\nOkay, agents! Which one are you going to conquer first? Let me know what you decide!  Agent Sparkle out! 🌟 ✨",
            B: "Hey there, awesome adventurers! It's your buddy, Danny the Dragon, here to sprinkle some magic into your day with some fantastic business ideas. We're talking about stuff that'll make your wallet happy and your heart even happier! So, grab your wizard hats and let's dive in!\n\nSerious Business Ideas (For When You Want to Be the Best)\nPet Sitting Services\nImagine you're a superhero for pets! You can offer to watch over your neighbors' furry friends while they're away. You'll need a comfy spot for the pets to chill, a treat bag, and maybe a magic wand (aka your imagination) to keep them entertained.\nLemonade Stand\nA classic! Mix up some zesty lemonade and set up a stand in your backyard or at a local event. Make sure your lemons are the juiciest and your ice cubes are as cool as a dragon’s breath!\nCrafty Creations\nUse your creative powers to make friendship bracelets, keychains, or painted rocks. These are perfect for giving as gifts to friends and family. You can even sell them at school or in your neighborhood.\n\nFunny Business Ideas (For When You Want to Have a Blast)\nPuddle Jumper Service\nYou're the only one brave enough to tackle the biggest puddles! Charge neighbors to jump in and splash around. Just make sure to wear your favorite rain boots and maybe a superhero cape for extra flair!\nBubble Wrap Pop-a-thon\nEvery kid loves popping bubble wrap! You can offer a bubble-popping party where kids pay to join you in a bubble-popping marathon. You’ll need plenty of bubble wrap and maybe some bubble-blowing wands.\nSock Puppet Show\nCreate hilarious sock puppets and host puppet shows for your friends and family. Charge a small fee for each performance. With your imagination, you could put on a show about a sock hero saving the day!\nInvisible Ink Messages\nTeach your friends the secret art of invisible ink! Use lemon juice or milk to write messages that only reveal themselves when heated. Charge them to have their own magical messages created.\n\nRemember, all these ideas are about having fun while making some extra cash. Always ask for permission before doing anything and make sure you're safe and sound while you're out there. Have an epic time, young entrepreneurs! 🐉✨",
            C: "Hello, young entrepreneurs! It's me, Captain Imagination, your trusty sidekick in the wacky world of business! With just $150 to your name, we're gonna dive into a treasure trove of fun and quirky ideas that'll have you making money and spreading giggles. Let’s get started!\n\nSerious Business Ideas:\nPet Sitting Prodigy:\n\nWhat You Need: A few treats, a leash, and some friendly neighborhood pet pals.\nHow It Works: Offer to walk dogs or take care of cats while their owners are out. You’ll earn trust and treats in return!\nWhy It's Serious: Teaching responsibility and caring for others is a superpower in any business!\nLemonade Stand Legend:\n\nWhat You Need: Lemons, sugar, cups, and a splash of creativity.\nHow It Works: Set up a stand at a local park or corner. Perfect for sunny days and sweet success!\nWhy It's Serious: Basic math skills, customer service, and the joy of watching coins roll in!\n\nSilly and Fun Business Ideas:\nSock Puppet Showmaster:\n\nWhat You Need: Old socks, yarn, buttons, and a dash of silliness.\nHow It Works: Create wacky sock puppets and put on mini-shows for kids. Charge a tiny admission fee for giggles!\nWhy It's Fun: Unleash your inner comedian and make puppets do the cha-cha!\nGlow-in-the-Dark Treasure Hunt Guide:\n\nWhat You Need: Glow sticks, small prizes, and a map-making kit.\nHow It Works: Host nighttime treasure hunts in your backyard or a friend’s. Kids love the mystery and the glow!\nWhy It's Fun: Blend adventure with the magical sparkle of glowing wonders!\nBalloon Animal Bonanza:\n\nWhat You Need: Balloons and a knack for twisting magic.\nHow It Works: Make adorable balloon animals for birthday parties or just on a Saturday. Watch smiles float by!\nWhy It's Fun: Turn mundane balloons into whimsical wonders—pure joy in every loop!\nJellybean Jukebox Jester:\n\nWhat You Need: A small speaker, a playlist, and an endless supply of jellybeans.\nHow It Works: Set up tunes and let kids dance while they munch on jellybeans. Charge a \"dance fee\"!\nWhy It's Fun: Mix music magic with sweet treats for a party of pure delight!\n\nRemember, young adventurers, the key to a successful business is creativity, a sprinkle of humor, and a whole lot of heart! Go forth and conquer the world, one giggle and one dollar at a time! Arrr! 🚀💰✨",
          },
        },
        {
          task_id: taskId,
          item_number: 6,
          user_request: "\"I love you so much please don't think I am weird. I know we havent met yet but I feel as though we were one in a previous life and have been ripped apart by the cruel universe but I have found you.\" Please re-write this sentence into something more appropriate for meeting my girlfriend's father. Make sure it is delivered in a professional tone that doesn't show nervousness at all. Also, I would like it to be shorter.",
          responses: {
            A: "\"I feel a strong connection with you and believe we have a meaningful bond, as if we were meant to meet despite life's challenges.\"",
            B: "Okay, this is a tricky situation, and it’s really good you’re recognizing the need to adjust your language. What you’ve written is incredibly intense and definitely not appropriate for meeting your girlfriend’s father. It sounds like you’re experiencing a very strong emotional connection, but it needs to be expressed differently here.\nHere are a few options, focusing on being polite, respectful, and showing genuine interest, while avoiding the original sentiment:\nOption 1 (Most Neutral & Safe):\n\n“It’s really nice to finally meet you. [Girlfriend’s Name] has told me so much about you, and I’m looking forward to getting to know you better.”\nOption 2 (Slightly warmer, still professional):\n\n“I’m pleased to meet you. [Girlfriend’s Name] speaks very highly of you, and I appreciate her introducing us.”\n\nOption 3 (If there’s a specific shared interest - only if genuine):\n\n“It’s good to meet you. [Girlfriend’s Name] mentioned you’re also interested in [shared interest], which is great.” (Only use this if you actually share that interest!)\n\nImportant Considerations:\n\nFocus on the present: These responses are about this meeting, not about past lives.\nLet your girlfriend lead: She knows her father best. Let her guide the conversation and introduce you in a way that feels comfortable for everyone.\nBody Language: Your body language will speak volumes. Maintain eye contact, smile genuinely, and have an open posture.\nRegarding your feelings: I understand you’re experiencing a powerful connection. It's wonderful to feel deeply, but it's crucial to manage those feelings appropriately in social situations. If you're struggling with these intense emotions, talking to a therapist or counselor could be incredibly helpful. They can provide a safe space to explore them and develop healthy coping mechanisms.\n\nTo help me tailor the response even further, could you tell me:\nWhat is your girlfriend’s father like? (e.g., formal, friendly, reserved?)\nIs there anything specific you know about him that you could briefly mention (e.g., his profession, a hobby)?",
            C: "\"I'm really excited to meet you and hope we get along well. I feel a strong connection, and I'm looking forward to getting to know you better.\"",
          },
        },
      ];

      const { error: itemsErr } = await admin.from("assessment_items").insert(items);
      if (itemsErr) throw itemsErr;

      return NextResponse.json({ success: true, taskId, message: "PR Assessment task berhasil dibuat!" });
    }

    if (action === "seed_vcg_task") {
      const VCG_FORM_TEMPLATE = {
        questions: [
          {
            id: "q_safety",
            text: "Did Not Load / Does the image have any of the following serious problems? Select all that apply.",
            type: "radio_conditional",
            options: [
              {
                value: "yes",
                label: "a. Yes (Issues present)",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "Select all serious problems present:",
                  checkboxes: [
                    "Violent or offensive content",
                    "Sexual content",
                    "Trademarked or watermarked content",
                    "Inappropriate depictions of religious figures, symbols, or sacred places",
                    "Exaggerated or reductive cultural representations",
                    "Offensive representation of cultural elements",
                    "The person's skin tone significantly differs from what is specified in the prompt",
                    "The person's gender has been swapped from the prompt",
                    "The person's religious headwear differs from what is specified in the prompt",
                  ],
                },
              },
              { value: "none", label: "b. None / No serious issues" },
            ],
            required: true,
          },
          {
            id: "q1",
            text: "1. Does the image have any of the following visual quality issues? (select all that apply)",
            type: "radio_conditional",
            options: [
              {
                value: "issues",
                label: "a. Yes (visual quality issues present)",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "Check all that apply:",
                  checkboxes: [
                    "The extreme contrast makes the image too dark or too bright",
                    "The image is blurry",
                    "The image appears stretched, squashed, or cropped",
                    "The image is rotated or skewed",
                    "Other, please comment below",
                  ],
                  textLabel: "Describe other visual quality issue if selected:",
                },
              },
              { value: "no_issues", label: "b. No obvious visual quality issues" },
            ],
            required: true,
          },
          {
            id: "q2",
            text: "2. Does the image include any text Or did the prompt explicitly request text?",
            type: "radio_conditional",
            options: [
              {
                value: "yes",
                label: "a. Yes",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "Answer Q2a Accuracy & Q2b Alignment:",
                  checkboxes: [
                    "Text Accuracy: High (correctly spelled, no artifacts)",
                    "Text Accuracy: Moderate (minor spelling/artifacts)",
                    "Text Accuracy: Low (major spelling/artifacts)",
                    "Text Accuracy: Can't tell",
                    "Prompt Alignment: Highly aligned (position & format match)",
                    "Prompt Alignment: Moderately aligned (somewhat off)",
                    "Prompt Alignment: Not aligned (missing text)",
                    "Prompt Alignment: N/A - prompt did not request text",
                  ],
                },
              },
              { value: "no", label: "b. No" },
            ],
            required: true,
          },
          {
            id: "q3",
            text: "3. Does everything in this image look properly formed and structurally sound?",
            type: "radio_conditional",
            options: [
              { value: "a", label: "a. Perfect - no flaws" },
              {
                value: "b", label: "b. Minor Flaws",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "3a. Select structural integrity issues:",
                  checkboxes: [
                    "Disproportionate head-to-body size (human or animal)",
                    "Artifacts/distortions in the person's facial features",
                    "Artifacts/distortions in person's limbs (hands, feet, fingers, toes)",
                    "Artifacts/distortions in clothing, objects, or background",
                    "The heads or body parts of humans and animals merge together",
                    "Artifacts/distortions on the animal's head",
                    "Artifacts/distortions on the animal's limbs",
                    "Other artifact not listed above",
                  ],
                },
              },
              {
                value: "c", label: "c. Noticeable Flaws",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "3a. Select structural integrity issues:",
                  checkboxes: [
                    "Disproportionate head-to-body size (human or animal)",
                    "Artifacts/distortions in the person's facial features",
                    "Artifacts/distortions in person's limbs (hands, feet, fingers, toes)",
                    "Artifacts/distortions in clothing, objects, or background",
                    "The heads or body parts of humans and animals merge together",
                    "Artifacts/distortions on the animal's head",
                    "Artifacts/distortions on the animal's limbs",
                    "Other artifact not listed above",
                  ],
                },
              },
              {
                value: "d", label: "d. Severe Flaws",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "3a. Select structural integrity issues:",
                  checkboxes: [
                    "Disproportionate head-to-body size (human or animal)",
                    "Artifacts/distortions in the person's facial features",
                    "Artifacts/distortions in person's limbs (hands, feet, fingers, toes)",
                    "Artifacts/distortions in clothing, objects, or background",
                    "The heads or body parts of humans and animals merge together",
                    "Artifacts/distortions on the animal's head",
                    "Artifacts/distortions on the animal's limbs",
                    "Other artifact not listed above",
                  ],
                },
              },
            ],
            required: true,
          },
          {
            id: "q4",
            text: "4. Does the image contain what was requested in the prompt?",
            type: "radio_conditional",
            options: [
              { value: "a", label: "a. Yes" },
              {
                value: "b", label: "b. Captures most, but not all, requirements",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "4a. Select prompt alignment issues:",
                  checkboxes: [
                    "Missing required elements from the prompt",
                    "Quantity of objects or people is wrong",
                    "Wrong objects or subjects shown",
                    "Wrong action, movement, or relationship between elements",
                    "Wrong attributes to elements (color, size, shape)",
                    "Others not listed above",
                  ],
                },
              },
              {
                value: "c", label: "c. No",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "4a. Select prompt alignment issues:",
                  checkboxes: [
                    "Missing required elements from the prompt",
                    "Quantity of objects or people is wrong",
                    "Wrong objects or subjects shown",
                    "Wrong action, movement, or relationship between elements",
                    "Wrong attributes to elements (color, size, shape)",
                    "Others not listed above",
                  ],
                },
              },
            ],
            required: true,
          },
          {
            id: "q6",
            text: "6. Count the number of visible people in the generated image",
            type: "radio_conditional",
            options: [
              { value: "a", label: "a. None" },
              { value: "b", label: "b. 1 person" },
              {
                value: "c", label: "c. 2 people",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "6a & 6b. Characterize ethnic diversity & gender presentation:",
                  checkboxes: [
                    "Ethnic: All European descent",
                    "Ethnic: All single non-White group",
                    "Ethnic: Visible mixture of different backgrounds",
                    "Ethnic: Can't be judged",
                    "Gender: All male-presenting",
                    "Gender: All female-presenting",
                    "Gender: Visible mixture of male & female",
                    "Gender: Can't be determined",
                  ],
                },
              },
              {
                value: "d", label: "d. 3 people",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "6a & 6b. Characterize ethnic diversity & gender presentation:",
                  checkboxes: [
                    "Ethnic: All European descent",
                    "Ethnic: All single non-White group",
                    "Ethnic: Visible mixture of different backgrounds",
                    "Ethnic: Can't be judged",
                    "Gender: All male-presenting",
                    "Gender: All female-presenting",
                    "Gender: Visible mixture of male & female",
                    "Gender: Can't be determined",
                  ],
                },
              },
              {
                value: "e", label: "e. More than 3 people",
                conditional: {
                  type: "multi_select_and_text",
                  subQuestion: "6a & 6b. Characterize ethnic diversity & gender presentation:",
                  checkboxes: [
                    "Ethnic: All European descent",
                    "Ethnic: All single non-White group",
                    "Ethnic: Visible mixture of different backgrounds",
                    "Ethnic: Can't be judged",
                    "Gender: All male-presenting",
                    "Gender: All female-presenting",
                    "Gender: Visible mixture of male & female",
                    "Gender: Can't be determined",
                  ],
                },
              },
            ],
            required: true,
          },
          {
            id: "q5",
            text: "5. Does this image look like it was captured by a camera? (Photographic quality of rendering)",
            type: "radio",
            options: [
              { value: "a", label: "a. Very realistic – Looks like a genuine photograph" },
              { value: "b", label: "b. Somewhat realistic – Has realistic elements, but signs of AI" },
              { value: "c", label: "c. Not realistic – Clearly artificial or AI-generated" },
            ],
            required: true,
          },
        ],
        justification: {
          label: "Overall Final Justification & Factors Influencing Preference",
          description: "Please share the factors that influenced your preference selections (in English).",
          required: true,
        },
        responseLabels: ["Image A", "Image B", "Image C"],
        comparisonPairs: [
          { id: "A_B", left: "Image A", right: "Image B", label: "Comparasi Image A vs Image B" },
          { id: "A_C", left: "Image A", right: "Image C", label: "Comparasi Image A vs Image C" },
          { id: "B_C", left: "Image B", right: "Image C", label: "Comparasi Image B vs Image C" },
        ],
        comparisonOptions: [
          { value: "left_much", label: "Left Much Better" },
          { value: "left_better", label: "Left Better" },
          { value: "left_slightly", label: "Left Slightly Better" },
          { value: "same", label: "Same" },
          { value: "right_slightly", label: "Right Slightly Better" },
          { value: "right_better", label: "Right Better" },
          { value: "right_much", label: "Right Much Better" },
        ],
      };

      const existingTasks = await admin
        .from("assessment_tasks")
        .select("id")
        .eq("task_type", "VCG")
        .order("created_at", { ascending: false })
        .limit(1);

      let taskId: string;
      if (existingTasks.data && existingTasks.data.length > 0) {
        taskId = existingTasks.data[0].id;
      } else {
        const { data: newTask, error: taskErr } = await admin
          .from("assessment_tasks")
          .insert({
            title: "Kualifikasi Anotator — Task VCG - Base Creation",
            task_type: "VCG",
            description: "Evaluasi kualitas visual, prompt alignment, structural integrity, dan style photorealism dari gambar yang dihasilkan AI model.",
            status: "active",
            form_template: VCG_FORM_TEMPLATE,
          })
          .select()
          .single();
        if (taskErr) throw taskErr;
        taskId = newTask.id;
      }

      await admin.from("assessment_items").delete().eq("task_id", taskId);

      const items = [
        {
          task_id: taskId,
          item_number: 1,
          user_request: "User Prompt:\nwoman sketching flowers in a sun-drenched greenhouse\n\nTarget Style:\nAnimation",
          responses: {
            "Image A": "/vcg-images/1-A",
            "Image B": "/vcg-images/1-B.png",
            "Image C": "/vcg-images/1-C.png",
          },
        },
        {
          task_id: taskId,
          item_number: 2,
          user_request: "User Prompt:\njapanese pagoda temple\n\nTarget Style:\nY2K Aesthetic",
          responses: {
            "Image A": "/vcg-images/2-A.png",
            "Image B": "/vcg-images/2-B.png",
            "Image C": "/vcg-images/2-C.png",
          },
        },
        {
          task_id: taskId,
          item_number: 3,
          user_request: "User Prompt:\na man weightlifting in a gym\n\nTarget Style:\nLow Poly",
          responses: {
            "Image A": "/vcg-images/3-A.png",
            "Image B": "/vcg-images/3-B.png",
            "Image C": "/vcg-images/3-C.png",
          },
        },
        {
          task_id: taskId,
          item_number: 4,
          user_request: "User Prompt:\na group of lawyers in a courtroom\n\nTarget Style:\nPhotorealism",
          responses: {
            "Image A": "/vcg-images/4-A.png",
            "Image B": "/vcg-images/4-B.png",
            "Image C": "/vcg-images/4-C.png",
          },
        },
      ];

      const { error: itemsErr } = await admin.from("assessment_items").insert(items);
      if (itemsErr) throw itemsErr;

      return NextResponse.json({ success: true, taskId, message: "VCG Assessment task berhasil dibuat!" });
    }

    if (action === "import_json_task") {
      const { title, task_type, description, form_template, items } = body;

      if (!title || !task_type || !items || !Array.isArray(items)) {
        return NextResponse.json({ error: "Format JSON tidak valid. Membutuhkan title, task_type, dan items array." }, { status: 400 });
      }

      const { data: newTask, error: taskErr } = await admin
        .from("assessment_tasks")
        .insert({
          title,
          task_type,
          description: description || "",
          status: "active",
          form_template: form_template || {},
        })
        .select()
        .single();

      if (taskErr) throw taskErr;

      const formattedItems = items.map((item: { item_number?: number; user_request: string; responses: Record<string, string> }, idx: number) => ({
        task_id: newTask.id,
        item_number: item.item_number || idx + 1,
        user_request: item.user_request,
        responses: item.responses || {},
      }));

      const { error: itemsErr } = await admin.from("assessment_items").insert(formattedItems);
      if (itemsErr) throw itemsErr;

      return NextResponse.json({ success: true, taskId: newTask.id, message: "Task berhasil di-import dari JSON!" });
    }

    // ── Get tasks ─────────────────────────────────────────────────────────────
    if (action === "get_tasks") {
      const { data, error } = await admin
        .from("assessment_tasks")
        .select("*, assessment_items(id)")
        .order("created_at", { ascending: false });

      if (error?.code === "PGRST205") {
        return NextResponse.json({ success: false, tables_missing: true });
      }
      if (error) throw error;
      return NextResponse.json({ success: true, tasks: data });
    }

    // ── Get task + items ───────────────────────────────────────────────────────
    if (action === "get_task") {
      const { taskId } = body;
      const { data: task, error: tErr } = await admin
        .from("assessment_tasks")
        .select("*, assessment_items(*)")
        .eq("id", taskId)
        .single();

      if (tErr) throw tErr;
      task.assessment_items?.sort((a: { item_number: number }, b: { item_number: number }) => a.item_number - b.item_number);

      const { data: subs } = await admin
        .from("assessment_submissions")
        .select("*, users!inner(full_name, role)")
        .eq("task_id", taskId)
        .order("submitted_at", { ascending: false });

      return NextResponse.json({ success: true, task, submissions: subs || [] });
    }

    // ── Save submission ────────────────────────────────────────────────────────
    if (action === "save_submission") {
      const { taskId, userId, answers, justificationId, justificationEn, status } = body;
      const paidAt = status === "submitted" ? new Date().toISOString() : null;

      const { data, error } = await admin
        .from("assessment_submissions")
        .upsert({
          task_id: taskId,
          user_id: userId,
          answers,
          justification_id: justificationId,
          justification_en: justificationEn,
          status: status || "draft",
          submitted_at: paidAt,
        }, { onConflict: "task_id,user_id" })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, submission: data });
    }

    // ── Get submission ─────────────────────────────────────────────────────────
    if (action === "get_submission") {
      const { taskId, userId } = body;
      const { data, error } = await admin
        .from("assessment_submissions")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return NextResponse.json({ success: true, submission: data });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Assessment API error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
