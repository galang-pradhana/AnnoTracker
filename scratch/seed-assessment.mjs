// Script: seed-assessment.mjs
// Run: node scratch/seed-assessment.mjs
// Seeds the PR assessment task with 2 questions

import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

// PR Task form template (fixed question schema)
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

// Assessment task data
const task = {
  title: "Kualifikasi Anotator — Task PR (Proofreading & Evaluation)",
  task_type: "PR",
  description: "Tes evaluasi awal untuk memastikan karyawan memahami cara memberikan rating pada response AI berdasarkan kriteria localization, conciseness, truthfulness, dan satisfaction sesuai guideline.",
  status: "active",
  form_template: PR_FORM_TEMPLATE,
};

// Assessment items (questions/prompts)
const items = [
  {
    item_number: 1,
    user_request: `I work in a travel agency, and my current task is to come up with a photo caption for an advertisement to attract more people to visit Yala province. Please write the ad photo caption for me. The caption must be about inviting people from other provinces in Thailand to visit Yala, mentioning the advantages of Yala province and other tourism promotion information. I'd like exactly 5 lines, but the content must be comprehensive and concise.`,
    responses: {
      A: `Open up a new experience with Yala, a place full of diverse cultures and stunning nature. Experience the charm of cave waterfalls, ancient temples, and delicious, mouth-watering local food. Whether it's an adventure in the mountains or relaxing by the sea, Yala is ready to welcome you with unforgettable warmth and impressions. Come explore and create lasting memories with us today!`,
      B: `Yala... The destination waiting for you! Inviting Thais nationwide to experience the beauty of its diverse nature and culture.

Experience the fresh air and peaceful atmosphere, perfect for true relaxation in Yala province.

Travel safely with complete facilities, alongside warm service from the locals.

Join in experiencing history and exciting cultural activities in the unique areas of Yala.

Come visit Yala today... A worthwhile new experience for everyone across Thailand!`,
      C: `Calling everyone across Thailand to experience the charm of Yala province!
A province endowed with beautiful nature and diverse cultures.
Feel the warmth of the local community and taste the delicious local dishes.
Unlock new and unique experiences in Yala province.
Come visit Yala for a truly memorable adventure!`,
    },
  },
  {
    item_number: 2,
    user_request: `which of these artists could be included in an essay about 20th century artists?

Pablo Picasso
Frida Kahlo
Andy Warhol
Georgia O'Keeffe
Michelangelo
Salvador Dalí
Jackson Pollock
Henri Matisse
René Magritte
Eugène Delacroix
Edvard Munch`,
    responses: {
      A: `Okay, let's break down which of those artists would be a good fit for an essay about 20th-century artists. Here's a breakdown, with explanations:

Definitely Included (Strong Choices):

Pablo Picasso: Absolutely essential. He was a hugely influential figure throughout the entire 20th century, pioneering Cubism and constantly experimenting.
Frida Kahlo: A major figure in the mid-20th century, known for her intensely personal and symbolic self-portraits.
Andy Warhol: A cornerstone of Pop Art, representing the shift in art towards consumerism and mass culture.
Georgia O'Keeffe: A significant figure in American Modernism, particularly known for her large-scale paintings of flowers and Southwestern landscapes.
Jackson Pollock: A key figure in Abstract Expressionism, revolutionizing painting with his drip technique.
Salvador Dalí: A prominent Surrealist, known for his dreamlike imagery and bizarre juxtapositions.

Good Choices – Depending on the Essay's Focus:

Henri Matisse: While much of his important work was before the 20th century, his Fauvist style significantly influenced the early 20th century. Including him would be relevant if you're discussing the transition from traditional art to modernism.

Not Included (Primarily Pre-20th Century):

Michelangelo: A High Renaissance master (1475-1564). His work is firmly rooted in the 15th and 16th centuries.
Eugène Delacroix: A key Romantic painter (1798-1863). He's a product of the 19th century.
Edvard Munch: A Norwegian Expressionist (1863-1944), but his most influential work was created in the late 19th and early 20th centuries – he's a bridge between the two periods.

To help me narrow it down even further and give you more targeted advice, could you tell me:

What's the essay about? (e.g., "The Rise of Modern Art," "The Impact of Surrealism," "American Art in the 20th Century," etc.)
What's the essay's length/scope? (e.g., a short paragraph, a 5-page paper, etc.)`,
      B: `For an essay about 20th-century artists, you could include the following artists:

Pablo Picasso
Frida Kahlo
Andy Warhol
Georgia O'Keeffe
Salvador Dalí
Jackson Pollock
Henri Matisse
René Magritte
Edvard Munch

Michelangelo and Eugène Delacroix are primarily associated with the 16th and 19th centuries, respectively, so they would not be appropriate for this essay focused on 20th-century artists.`,
      C: `For an essay about 20th-century artists, you would include the following individuals from your list:

Pablo Picasso - Known for his significant contributions to modern art, including Cubism, which emerged in the early 20th century.

Frida Kahlo - A prominent figure in 20th-century art, recognized for her deeply personal and symbolic self-portraits.

Andy Warhol - A key figure in the Pop Art movement, which became prominent in the mid-20th century.

Georgia O'Keeffe - Although her work gained prominence later, her unique style and focus on American landscapes were influential in the 20th century.

Salvador Dalí - Known for his surrealist works, which were highly influential throughout the 20th century.

Jackson Pollock - Central to the Abstract Expressionism movement, a dominant force in 20th-century art.

Henri Matisse - His work transitioned from Symbolism to Fauvism and continued to influence 20th-century art.

René Magritte - A leading figure in Surrealism, whose work significantly impacted the 20th century.

Artists like Michelangelo, Eugène Delacroix, and Edvard Munch are primarily associated with the 19th century, though their influence extended into the 20th century.`,
    },
  },
  {
    item_number: 3,
    user_request: `I am planning to open a cake shop and looking for a creative name. this name should based on some sweet food. I live in India hence the shop name should be suggested accordingly. also to be noted that the suggested name should not start from letters R,K,T,N. give me 10 suggestions please.`,
    responses: {
      A: `That sounds like a delightful venture! Here are ten creative cake shop name suggestions inspired by sweet foods, tailored for your Indian market and avoiding the letters you specified:

Mithai Morsels
Gulab Delight
Ladoo Layers
Rasmalai Reverie
Kaju Kheer Kitchen
Chakra Choco Corner
Peda Pastries
Jalebi Junction
Besan Bliss
Sandesh Sweets

I hope these inspire you in finding the perfect name for your cake shop!`,
      B: `Congratulations on your new venture! Here are ten creative cake shop name suggestions inspired by sweet foods, tailored for your Indian location, and avoiding the specified letters:

ChocoCharm
SweetSwirls
DessertDusk
SugarSerenade
FlourFusion
CandyCove
PastryPalette
SugarSprout
ConfectionCraze
MeltMagic

These names aim to capture the essence of sweetness while resonating with your local market.`,
      C: `Okay, let’s brainstorm some creative cake shop names based on sweet Indian foods, avoiding R, K, T, and N! Here are 10 suggestions, with a little explanation of the inspiration behind each:

Gulab Bliss: "Gulab" refers to Gulab Jamun, a classic Indian sweet, and "Bliss" evokes the joy of eating cake. It’s warm, inviting, and instantly recognizable.
Jalebi Joy: Similar to the above, “Jalebi” is another hugely popular Indian sweet known for its swirls and caramel flavor. “Joy” adds a positive feeling.
Barfi Bites: “Barfi” is a rich, milk-based sweet. "Bites" suggests smaller, manageable cakes and treats. 
Chocolat Chaat: A playful combination! "Chaat" is a popular Indian savory snack, and pairing it with “Chocolat” hints at decadent chocolate cakes. 
Kheer Dreams: “Kheer” is a rice pudding, a beloved dessert. "Dreams" suggests the delightful experience of enjoying a cake.
Rasgulla Rose: "Rasgulla" is a spongy, syrupy ball, and “Rose” adds a touch of elegance and floral fragrance, often found in Indian desserts.
Saffron Sugar: “Saffron” is a precious spice used in many Indian sweets, and "Sugar" clearly indicates the focus on sweetness. It sounds sophisticated.
Halwa Haven: “Halwa” is a rich, dense pudding. "Haven" suggests a safe and delightful place to indulge.
Mango Muse: "Mango" is a hugely popular fruit in India, and “Muse” implies inspiration and creativity in your baking.
Peda Paradise: “Peda” is a dense, crumbly milk-based sweet. "Paradise" promises a truly delightful experience.

To help me narrow it down and give you even more tailored suggestions, could you tell me:

What kind of cakes will you specialize in? (e.g., traditional Indian flavors, fusion cakes, classic Western cakes, vegan options?)
What’s the overall vibe you're going for? (e.g., rustic and charming, modern and chic, playful and colorful?)`,
    },
  },
  {
    item_number: 4,
    user_request: `Rewrite the following text in contemporary speech without using any slang or Gen Z vernacular: "Tell me, O Muse, of the man of many devices, who wandered full many ways after he had sacked the sacred citadel of Troy. Many were the men whose cities he saw and whose mind he learned, aye, and many the woes he suffered in his heart upon the sea, seeking to win his own life and the return of his comrades.". Then create the first story beat entry of what you've rewritten at the end of the text.`,
    responses: {
      A: `Please, Muse, recount the tale of the resourceful man who journeyed far and wide after the fall of the sacred city of Troy. He encountered numerous cities and learned from their people, but he also endured many hardships at sea, striving to survive and reunite with his fellow travelers.

Story Beat Entry:

The sun dipped below the horizon, casting long shadows over the restless sea. Odysseus stood at the helm of his battered ship, his eyes scanning the endless expanse for any sign of hope or danger. The remnants of Troy lay behind him, a distant memory that weighed heavily on his heart. As the waves crashed against the hull, he resolved to press on, knowing that every challenge he faced brought him closer to the safety of his homeland and the reunion with his beloved family.`,
      B: `Okay, here’s a rewrite of the text in contemporary speech, avoiding slang and Gen Z terms:

“Listen, I want to hear about this guy – a really complicated one. After he took Troy, he just kept traveling, going everywhere. He saw so many different cities and met so many people, learning about their lives. And, honestly, he went through a lot of hardship, a lot of sadness, especially on the sea. He was desperately trying to survive and bring his friends home.”

First Story Beat Entry:

Beat 1: The rain hammered against the bronze roof of the longship, a relentless, grey drumming that mirrored the ache in Odysseus’s chest. Salt spray stung his face, blurring the already indistinct outline of the storm-wracked horizon. He gripped the tiller, his knuckles white, and stared out into the churning blackness. Three years. Three years since the fall of Troy, three years since he’d last seen the faces of his men, three years of a journey fueled by a single, consuming obsession: to return home. The wind howled a mournful song, a constant reminder of the ghosts he carried with him – the fallen warriors, the lost comrades, and the crushing weight of his own impossible task. He tasted blood, not from a wound, but from the bitter tang of regret. He was a man forged in battle, yes, but tonight, he felt like a broken thing, adrift on a sea of sorrow.`,
      C: `Tell me, Muse, about the clever man who traveled extensively after he destroyed the sacred city of Troy. He visited numerous cities and gained a wealth of knowledge, yet he endured many hardships at sea, constantly striving to survive and bring his fellow travelers home.

Story Beat Entry:

Introduction of Odysseus: Clever man who embarks on a perilous journey after the fall of Troy, seeking survival and reunion with his companions.`,
    },
  },
  {
    item_number: 5,
    user_request: `Give me some business ideas for a 10-year-old with $150 of startup money. This should be within reason for a 10-year-old to complete on their own. Make at least half of the ideas funny and that a 10-year-old would enjoy doing. Present it in the voice of a character the kids will know and listen to.`,
    responses: {
      A: `Okay, hey there, future entrepreneurs! It’s Agent Sparkle here, your official guide to turning those pennies into…well, a lot of pennies!  I’ve been tracking the coolest kids in the world and I’ve got some seriously awesome business ideas for you, all with a budget of $150. Let’s do this! 
(Agent Sparkle adjusts a sparkly headset and beams)

1. Personalized Sticker Squad (Seriously Fun!)

The Idea: Everyone loves stickers! You create custom sticker sheets with inside jokes, drawings of their favorite characters, or even little motivational messages.
Startup Cost: $30-50 for sticker paper, markers, and maybe a small laminator (you can find cheap ones online!).
How it Works: Ask friends, neighbors, and family what they'd want on their sheets. Design them, print, and sell them for $2-5 each.
Agent Sparkle Says: “This is totally you! You get to be creative and make people smile. Plus, imagine the epic sticker sheets you’ll design!”

2. Miniature Monster Mailer Service (A Little Spooky, A Lot Cute!)

The Idea: Create tiny, adorable monster mailers! You design and make little monster characters (think fluffy, silly monsters, not scary ones!) and package them with a handwritten note.
Startup Cost: $60-80 for felt, googly eyes, pipe cleaners, glue, small envelopes, and maybe some glitter (because sparkle!).
How it Works: Offer to deliver these little monsters to friends and family. Charge $3-5 per mailer.
Agent Sparkle Says: “These are seriously adorable! You’ll be a tiny monster messenger – how cool is that?”

3. Backyard Bug Observation Station (For the Nature Nerds!)

The Idea: Lots of kids are curious about bugs! You set up a simple observation station in your backyard – a small jar with a magnifying glass, a notebook for recording observations, and maybe a little sign.
Startup Cost: $40-60 for a small jar, magnifying glass, notebook, pencils, and a small sign made from cardboard.
How it Works: Charge a small fee (like $1-2) for kids to come and observe bugs with you. You could even create little "bug fact sheets" to sell.
Agent Sparkle Says: “You’re a bug detective! This is perfect if you love exploring the outdoors and learning about creepy crawlies.”

4. Lemonade Stand 2.0: The Themed Stand (Let's Get Fancy!)

The Idea: Don’t just do a regular lemonade stand! Pick a theme – Pirate Lemonade, Superhero Lemonade, Rainbow Lemonade – and decorate accordingly.
Startup Cost: $50-70 for decorations (streamers, tablecloths, themed signs), cups, ice, and lemons.
How it Works: Charge a little more for your themed lemonade ($2-3 a cup).
Agent Sparkle Says: “This is a classic, but with a sparkle twist! People love a good theme!”

5. Lost Toy Finder (Helping People, Getting Paid!)

The Idea: Offer to help people find lost toys in your neighborhood. You could put up flyers or ask neighbors if they’d like your help.
Startup Cost: $20-40 for printing flyers and maybe some small prizes for finding toys (stickers, small candies).
How it Works: Charge a small fee (like $5-10) for your services.
Agent Sparkle Says: “You’re a neighborhood hero! This is a super helpful and rewarding business.”

6.  Crazy Sock Sorting Service (A Hilarious Task!)

The Idea: Let's be honest, nobody likes sorting socks. You offer to sort through people’s messy sock drawers and organize them into color-coded piles.
Startup Cost: $10-20 for a few colorful rubber bands or clips to help with organization.
How it Works: Charge $10-20 for a sock sorting session.
Agent Sparkle Says: "This is the weirdest, most brilliant idea! You're basically a sock wizard. Plus, you’ll be saving people hours of frustration."

Important Agent Sparkle Tips:

Talk to Your Parents: Make sure your parents are on board and can help you with anything you need.
Start Small: Don't try to do everything at once. Pick one idea and focus on making it awesome.
Be Friendly: A smile and a good attitude go a long way!
Have Fun! If you're not enjoying it, it's not worth it.

Okay, agents! Which one are you going to conquer first? Let me know what you decide!  Agent Sparkle out! 🌟 ✨`,
      B: `Hey there, awesome adventurers! It's your buddy, Danny the Dragon, here to sprinkle some magic into your day with some fantastic business ideas. We're talking about stuff that'll make your wallet happy and your heart even happier! So, grab your wizard hats and let's dive in!

Serious Business Ideas (For When You Want to Be the Best)
Pet Sitting Services
Imagine you're a superhero for pets! You can offer to watch over your neighbors' furry friends while they're away. You'll need a comfy spot for the pets to chill, a treat bag, and maybe a magic wand (aka your imagination) to keep them entertained.
Lemonade Stand
A classic! Mix up some zesty lemonade and set up a stand in your backyard or at a local event. Make sure your lemons are the juiciest and your ice cubes are as cool as a dragon’s breath!
Crafty Creations
Use your creative powers to make friendship bracelets, keychains, or painted rocks. These are perfect for giving as gifts to friends and family. You can even sell them at school or in your neighborhood.

Funny Business Ideas (For When You Want to Have a Blast)
Puddle Jumper Service
You're the only one brave enough to tackle the biggest puddles! Charge neighbors to jump in and splash around. Just make sure to wear your favorite rain boots and maybe a superhero cape for extra flair!
Bubble Wrap Pop-a-thon
Every kid loves popping bubble wrap! You can offer a bubble-popping party where kids pay to join you in a bubble-popping marathon. You’ll need plenty of bubble wrap and maybe some bubble-blowing wands.
Sock Puppet Show
Create hilarious sock puppets and host puppet shows for your friends and family. Charge a small fee for each performance. With your imagination, you could put on a show about a sock hero saving the day!
Invisible Ink Messages
Teach your friends the secret art of invisible ink! Use lemon juice or milk to write messages that only reveal themselves when heated. Charge them to have their own magical messages created.

Remember, all these ideas are about having fun while making some extra cash. Always ask for permission before doing anything and make sure you're safe and sound while you're out there. Have an epic time, young entrepreneurs! 🐉✨`,
      C: `Hello, young entrepreneurs! It's me, Captain Imagination, your trusty sidekick in the wacky world of business! With just $150 to your name, we're gonna dive into a treasure trove of fun and quirky ideas that'll have you making money and spreading giggles. Let’s get started!

Serious Business Ideas:
Pet Sitting Prodigy:

What You Need: A few treats, a leash, and some friendly neighborhood pet pals.
How It Works: Offer to walk dogs or take care of cats while their owners are out. You’ll earn trust and treats in return!
Why It's Serious: Teaching responsibility and caring for others is a superpower in any business!
Lemonade Stand Legend:

What You Need: Lemons, sugar, cups, and a splash of creativity.
How It Works: Set up a stand at a local park or corner. Perfect for sunny days and sweet success!
Why It's Serious: Basic math skills, customer service, and the joy of watching coins roll in!

Silly and Fun Business Ideas:
Sock Puppet Showmaster:

What You Need: Old socks, yarn, buttons, and a dash of silliness.
How It Works: Create wacky sock puppets and put on mini-shows for kids. Charge a tiny admission fee for giggles!
Why It's Fun: Unleash your inner comedian and make puppets do the cha-cha!
Glow-in-the-Dark Treasure Hunt Guide:

What You Need: Glow sticks, small prizes, and a map-making kit.
How It Works: Host nighttime treasure hunts in your backyard or a friend’s. Kids love the mystery and the glow!
Why It's Fun: Blend adventure with the magical sparkle of glowing wonders!
Balloon Animal Bonanza:

What You Need: Balloons and a knack for twisting magic.
How It Works: Make adorable balloon animals for birthday parties or just on a Saturday. Watch smiles float by!
Why It's Fun: Turn mundane balloons into whimsical wonders—pure joy in every loop!
Jellybean Jukebox Jester:

What You Need: A small speaker, a playlist, and an endless supply of jellybeans.
How It Works: Set up tunes and let kids dance while they munch on jellybeans. Charge a "dance fee"!
Why It's Fun: Mix music magic with sweet treats for a party of pure delight!

Remember, young adventurers, the key to a successful business is creativity, a sprinkle of humor, and a whole lot of heart! Go forth and conquer the world, one giggle and one dollar at a time! Arrr! 🚀💰✨`,
    },
  },
  {
    item_number: 6,
    user_request: `"I love you so much please don't think I am weird. I know we havent met yet but I feel as though we were one in a previous life and have been ripped apart by the cruel universe but I have found you." Please re-write this sentence into something more appropriate for meeting my girlfriend's father. Make sure it is delivered in a professional tone that doesn't show nervousness at all. Also, I would like it to be shorter.`,
    responses: {
      A: `"I feel a strong connection with you and believe we have a meaningful bond, as if we were meant to meet despite life's challenges."`,
      B: `Okay, this is a tricky situation, and it’s really good you’re recognizing the need to adjust your language. What you’ve written is incredibly intense and definitely not appropriate for meeting your girlfriend’s father. It sounds like you’re experiencing a very strong emotional connection, but it needs to be expressed differently here.
Here are a few options, focusing on being polite, respectful, and showing genuine interest, while avoiding the original sentiment:
Option 1 (Most Neutral & Safe):

“It’s really nice to finally meet you. [Girlfriend’s Name] has told me so much about you, and I’m looking forward to getting to know you better.”
Option 2 (Slightly warmer, still professional):

“I’m pleased to meet you. [Girlfriend’s Name] speaks very highly of you, and I appreciate her introducing us.”

Option 3 (If there’s a specific shared interest - only if genuine):

“It’s good to meet you. [Girlfriend’s Name] mentioned you’re also interested in [shared interest], which is great.” (Only use this if you actually share that interest!)

Important Considerations:

Focus on the present: These responses are about this meeting, not about past lives.
Let your girlfriend lead: She knows her father best. Let her guide the conversation and introduce you in a way that feels comfortable for everyone.
Body Language: Your body language will speak volumes. Maintain eye contact, smile genuinely, and have an open posture.
Regarding your feelings: I understand you’re experiencing a powerful connection. It's wonderful to feel deeply, but it's crucial to manage those feelings appropriately in social situations. If you're struggling with these intense emotions, talking to a therapist or counselor could be incredibly helpful. They can provide a safe space to explore them and develop healthy coping mechanisms.

To help me tailor the response even further, could you tell me:
What is your girlfriend’s father like? (e.g., formal, friendly, reserved?)
Is there anything specific you know about him that you could briefly mention (e.g., his profession, a hobby)?`,
      C: `"I'm really excited to meet you and hope we get along well. I feel a strong connection, and I'm looking forward to getting to know you better."`,
    },
  },
];

async function seed() {
  console.log("🌱 Seeding assessment tables...\n");

  // 1. Run migration SQL
  const migrationSql = `
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
  `;

  // Try to create tables
  const { error: migErr } = await supabase.rpc('exec_sql', { sql: migrationSql });
  if (migErr && migErr.code !== 'PGRST202') {
    console.warn("Migration warning (may already exist):", migErr.message);
  }

  // 2. Select or Insert assessment task
  const { data: existingTasks } = await supabase
    .from('assessment_tasks')
    .select('id')
    .eq('task_type', 'PR')
    .order('created_at', { ascending: false })
    .limit(1);

  let taskId;
  if (existingTasks && existingTasks.length > 0) {
    taskId = existingTasks[0].id;
    await supabase.from('assessment_tasks').update({ form_template: PR_FORM_TEMPLATE }).eq('id', taskId);
    console.log("✅ Existing PR Task found & updated:", taskId);
  } else {
    const { data: insertData, error: insertErr } = await supabase
      .from('assessment_tasks')
      .insert(task)
      .select()
      .single();

    if (insertErr) {
      console.error("Task insert failed:", insertErr);
      return;
    }
    taskId = insertData.id;
    console.log("✅ Task created:", taskId, insertData.title);
  }

  await insertItems(taskId);
}

async function insertItems(taskId) {
  // Delete existing items first
  await supabase.from('assessment_items').delete().eq('task_id', taskId);

  for (const item of items) {
    const { data, error } = await supabase
      .from('assessment_items')
      .insert({ ...item, task_id: taskId })
      .select()
      .single();

    if (error) {
      console.error(`  ❌ Item ${item.item_number} failed:`, error.message);
    } else {
      console.log(`  ✅ Item ${item.item_number} inserted:`, data.id);
    }
  }

  console.log("\n✅ Assessment seeding complete!");
  console.log(`Task ID: ${taskId}`);
  console.log(`Items: ${items.length} questions`);
}

seed().catch(console.error);
