import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import OpenAI from 'openai';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file = '.env.local') {
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    let value = rest.join('=');
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ||= value;
  }
}

loadEnv();

const projectId = 'f76c7004-14b0-4360-bccb-84424f71fb33';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

if (!supabaseUrl || !serviceKey || !openaiKey) {
  throw new Error('Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: openaiKey });

const posts = [
  {
    platform: 'instagram',
    title: 'Invoice Chaos',
    headline: 'Stop typing invoices',
    subheadline: 'BestRest extracts supplier invoice data automatically.',
    caption: 'חשבוניות ספקים מגיעות במייל, וואטסאפ ו-PDF — ובסוף מישהו מקליד הכול ידנית. BestRest מרכזת את החשבוניות, שולפת את הפריטים והמחירים, ועוזרת להבין מה באמת קורה לעלויות במסעדה. רוצה לבדוק על חשבונית אמיתית שלך?',
    hashtags: ['BestRest', 'מסעדות', 'ניהולמסעדה', 'חשבוניות', 'פודקוסט', 'restauranttech'],
    prompt: 'A premium realistic photo-style scene of a busy Israeli restaurant office desk with supplier invoices, receipts, a laptop showing a clean analytics dashboard shape without readable text, warm Mediterranean daylight, modern B2B SaaS advertising look, no words, no letters, no logos, no numbers, empty space for overlay.'
  },
  {
    platform: 'facebook',
    title: 'Supplier Price Increases',
    headline: 'Catch price increases',
    subheadline: 'See when suppliers quietly raise item prices.',
    caption: 'הספק העלה מחיר לעגבניות, שמן או גבינה — ואתה מגלה את זה רק בסוף החודש? BestRest עוזרת לזהות שינויי מחירים בין חשבוניות כדי שלא תנהל את הרווחיות לפי תחושת בטן.',
    hashtags: ['BestRest', 'ספקים', 'מסעדנות', 'ניהולעלויות', 'foodcost'],
    prompt: 'A realistic premium visual of fresh produce delivery crates at the back of a restaurant kitchen, a manager reviewing invoices on a tablet, subtle upward price chart motif as abstract shapes only, cinematic lighting, clean SaaS ad style, no readable text or logos.'
  },
  {
    platform: 'instagram',
    title: 'Food Cost Blindness',
    headline: 'Know your food cost',
    subheadline: 'Ingredient prices change. Your profit changes too.',
    caption: 'אם מחיר חומרי הגלם עולה והתפריט נשאר אותו דבר — הרווח נשחק בשקט. BestRest נבנית כדי לתת לבעלי מסעדות תמונה ברורה יותר של עלויות, מלאי וחשבוניות ספקים.',
    hashtags: ['FoodCost', 'BestRest', 'מסעדותישראל', 'רווחיות', 'restaurantowner'],
    prompt: 'A beautiful modern restaurant kitchen scene with ingredients arranged like a cost dashboard, chef and owner looking at a tablet, polished startup marketing image, high-end but practical, no text, no logos, no numbers.'
  },
  {
    platform: 'facebook',
    title: 'Accountant Reports',
    headline: 'Month-end without panic',
    subheadline: 'Cleaner invoice data for accountant-ready reports.',
    caption: 'סוף חודש לא חייב להיות מרדף אחרי חשבוניות חסרות. BestRest יכולה לעזור לרכז חשבוניות, לארגן נתונים ולהכין תמונה נקייה יותר לרואה החשבון.',
    hashtags: ['הנהלתחשבונות', 'מסעדות', 'BestRest', 'חשבוניותספקים'],
    prompt: 'A calm restaurant owner at the end of the month, neat organized invoices and laptop dashboard, accountant-ready report vibe, premium clean business photography, warm light, no visible words, no logos.'
  },
  {
    platform: 'instagram',
    title: 'WhatsApp Invoice Mess',
    headline: 'Invoices everywhere?',
    subheadline: 'Bring email, WhatsApp and PDFs into one workflow.',
    caption: 'חשבונית בתמונה, PDF במייל, עוד אחת בוואטסאפ — והכול מתפזר. BestRest מכוונת להפוך את בלגן החשבוניות לזרימת עבודה אחת וברורה.',
    hashtags: ['BestRest', 'וואטסאפ', 'חשבוניות', 'מסעדה', 'SaaS'],
    prompt: 'A modern visual metaphor of scattered supplier invoices, smartphone message bubbles as abstract shapes, email envelopes, and a clean central restaurant management dashboard on laptop, no readable text, no brand logos, vibrant SaaS style.'
  },
  {
    platform: 'facebook',
    title: 'Restaurant Owner Demo',
    headline: 'Test with real invoices',
    subheadline: 'See what BestRest finds in your supplier data.',
    caption: 'במקום עוד דמו כללי — אפשר לבדוק את BestRest על חשבוניות אמיתיות של העסק. כך תראה אם היא מזהה פריטים, מחירים ושינויים שבאמת חשובים לך.',
    hashtags: ['דמו', 'BestRest', 'מסעדנות', 'ניהולעסק'],
    prompt: 'A friendly Israeli restaurant owner in a small cafe reviewing a clean dashboard on a laptop with supplier invoices beside it, inviting demo atmosphere, realistic premium marketing photograph, no text or logos.'
  },
  {
    platform: 'instagram',
    title: 'Manual Excel Replacement',
    headline: 'Less Excel. More control.',
    subheadline: 'Move invoice work into an AI-assisted workflow.',
    caption: 'אקסל הוא כלי מצוין — אבל לא אמור להיות מערכת ניהול חשבוניות ומלאי למסעדה. BestRest נועדה לצמצם הקלדה ידנית ולתת שליטה טובה יותר בנתונים.',
    hashtags: ['Excel', 'BestRest', 'ניהולמלאי', 'חשבוניות', 'מסעדות'],
    prompt: 'A split-screen style realistic image: on one side messy spreadsheets and paper invoices, on the other side clean modern restaurant operations dashboard on laptop, premium SaaS before-after concept, no readable text, no logos.'
  },
  {
    platform: 'facebook',
    title: 'Small Chain Control',
    headline: 'One view for costs',
    subheadline: 'Useful for cafés, restaurants and small chains.',
    caption: 'כשיש כמה ספקים, כמה סניפים והרבה חשבוניות — קשה לדעת איפה העלות באמת זזה. BestRest מיועדת לתת לבעלי מסעדות ובתי קפה מבט מרכזי יותר על הנתונים.',
    hashtags: ['בתי_קפה', 'מסעדות', 'BestRest', 'ניהולסניפים'],
    prompt: 'A premium B2B SaaS visual of several small cafe and restaurant locations connected to one central dashboard, subtle map pins and data cards as abstract shapes, warm Israeli urban cafe feel, no text, no logos.'
  },
  {
    platform: 'instagram',
    title: 'OCR AI',
    headline: 'AI reads the invoice',
    subheadline: 'Extract item names, quantities and prices faster.',
    caption: 'הכוח של BestRest מתחיל בקריאת החשבונית: פריטים, כמויות ומחירים — בלי להקליד הכול מחדש. משם אפשר להתחיל להבין עלויות ושינויים.',
    hashtags: ['AI', 'OCR', 'BestRest', 'חשבוניות', 'restauranttech'],
    prompt: 'A futuristic but realistic close-up of a supplier invoice being scanned by AI light lines into a clean restaurant inventory dashboard, sophisticated technology aesthetic, no readable text, no numbers, no logos.'
  },
  {
    platform: 'facebook',
    title: 'Supplier Comparison',
    headline: 'Compare suppliers clearly',
    subheadline: 'Understand who changed prices and when.',
    caption: 'לא כל התייקרות מורגשת מיד. כשמשווים חשבוניות לאורך זמן, רואים מי העלה מחיר, באיזה פריט ומתי. זה בדיוק סוג השליטה ש-BestRest באה לתת.',
    hashtags: ['ספקים', 'BestRest', 'ניהולעלויות', 'מסעדנות'],
    prompt: 'A restaurant procurement scene with two supplier delivery boxes side by side, owner comparing clean visual dashboard cards on tablet, premium realistic SaaS ad, clear space for overlay, no text or logos.'
  },
  {
    platform: 'instagram',
    title: 'Inventory Awareness',
    headline: 'Inventory starts with data',
    subheadline: 'Invoices can become usable stock and cost signals.',
    caption: 'מלאי טוב מתחיל בנתונים טובים. אם החשבוניות לא מסודרות, קשה להבין מה נכנס, כמה עלה ומה השתנה. BestRest מחברת בין חשבוניות, עלויות ומלאי.',
    hashtags: ['מלאי', 'BestRest', 'מסעדה', 'ניהולמסעדה'],
    prompt: 'A clean restaurant storeroom with organized shelves, ingredients, barcode-like abstract data overlays, tablet dashboard in foreground, premium professional photography, no readable text or logos.'
  },
  {
    platform: 'facebook',
    title: 'Bookkeeper Angle',
    headline: 'Cleaner data for bookkeeping',
    subheadline: 'Help accountants get organized restaurant invoice records.',
    caption: 'רואי חשבון ומנהלי חשבונות מקבלים לעיתים נתונים מפוזרים ממסעדות. BestRest יכולה לעזור להפוך חשבוניות ספקים למידע מסודר וברור יותר.',
    hashtags: ['רואהחשבון', 'הנהלתחשבונות', 'BestRest', 'חשבוניות'],
    prompt: 'A professional accountant and restaurant owner reviewing organized digital invoice records on a laptop in a cafe setting, calm productive meeting, premium B2B SaaS look, no visible words or logos.'
  },
  {
    platform: 'instagram',
    title: 'Pilot Offer',
    headline: 'Looking for pilot restaurants',
    subheadline: 'Help shape BestRest with real supplier invoices.',
    caption: 'אנחנו מחפשים בעלי מסעדות ובתי קפה שרוצים לבדוק את BestRest על תהליך אמיתי. אם חשבוניות ספקים, מחירים ופוד קוסט הם כאב אצלך — דבר איתנו.',
    hashtags: ['Pilot', 'BestRest', 'מסעדותישראל', 'סטארטאפ', 'restauranttech'],
    prompt: 'An optimistic launch campaign visual for a restaurant SaaS pilot, modern cafe owner smiling with laptop, subtle rocket/startup energy through light shapes, premium realistic, no text, no logos.'
  },
  {
    platform: 'facebook',
    title: 'Final CTA',
    headline: 'Ready to see hidden costs?',
    subheadline: 'Start with your next supplier invoice.',
    caption: 'הדרך הכי טובה להבין אם BestRest מתאים לך: להתחיל מחשבונית ספק אחת. נבדוק מה אפשר לחלץ, אילו תובנות קיימות, ואיך זה יכול לחסוך זמן ושליטה בעסק.',
    hashtags: ['BestRest', 'חשבוניותספקים', 'ניהולמסעדה', 'FoodCost'],
    prompt: 'A confident final call-to-action visual: restaurant owner looking at a clean cost insights dashboard, supplier invoice on table, warm modern restaurant background, polished premium SaaS advertising image, no readable text, no logos.'
  }
];

function svgOverlay(post) {
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  return Buffer.from(`
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.45" stop-color="#000" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#fade)"/>
  <rect x="64" y="694" width="896" height="230" rx="34" fill="#0f172a" fill-opacity="0.76"/>
  <rect x="88" y="720" width="134" height="42" rx="21" fill="#7c3aed"/>
  <text x="155" y="748" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#fff">BestRest</text>
  <text x="92" y="820" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" fill="#fff">${esc(post.headline)}</text>
  <text x="94" y="878" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="500" fill="#e5e7eb">${esc(post.subheadline)}</text>
</svg>`);
}

function nextNoonUTC(dayOffset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(9, 0, 0, 0); // 12:00 Asia/Jerusalem during summer
  return d.toISOString();
}

async function main() {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id,user_id,name')
    .eq('id', projectId)
    .single();
  if (projectError || !project) throw new Error(`Project not found: ${projectError?.message || 'missing'}`);

  const userId = project.user_id;
  const campaignName = `BestRest 2-Week OpenAI Content Calendar — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      project_id: projectId,
      user_id: userId,
      name: campaignName,
      campaign_type: 'content_marketing',
      platforms: ['instagram', 'facebook'],
      status: 'active',
      goal: 'Generate qualified BestRest demo/pilot interest from Israeli restaurant and cafe owners.',
      metadata: {
        provider: 'openai',
        model: imageModel,
        source: 'Hermes generated direct calendar creation',
        strategy: '14 daily posts: invoice OCR, supplier price increases, food cost, accountant reports, pilot CTA',
      },
    })
    .select()
    .single();
  if (campaignError) throw new Error(`Campaign insert failed: ${campaignError.message}`);

  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('id,platform,status')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'active');
  const accountByPlatform = new Map((accounts || []).map(a => [a.platform, a.id]));

  const created = [];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`Generating ${i + 1}/${posts.length}: ${post.title}`);
    const image = await openai.images.generate({
      model: imageModel,
      prompt: `${post.prompt}\n\nBrand: BestRest, AI-powered invoice and inventory control for Israeli restaurants and cafes. Create a high-quality social media ad background. Do not render readable text, fake UI labels, brand logos, watermarks, letters, or numbers.`,
      size: '1024x1024',
      quality: 'medium',
      n: 1,
    });
    const b64 = image.data?.[0]?.b64_json;
    if (!b64) throw new Error(`OpenAI returned no image for ${post.title}`);
    const base = Buffer.from(b64, 'base64');
    const finalPng = await sharp(base)
      .resize(1024, 1024, { fit: 'cover' })
      .composite([{ input: svgOverlay(post), top: 0, left: 0 }])
      .png({ quality: 92 })
      .toBuffer();

    const slug = post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const fileName = `${userId}/${projectId}/${Date.now()}-${i + 1}-${slug}-openai.png`;
    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, finalPng, { contentType: 'image/png', upsert: false });
    if (uploadError) throw new Error(`Upload failed for ${post.title}: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from('generated-images').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;
    const scheduledAt = nextNoonUTC(i + 1);

    const { data: asset, error: assetError } = await supabase
      .from('campaign_assets')
      .insert({
        campaign_id: campaign.id,
        user_id: userId,
        asset_type: 'template_render',
        title: `${post.title} — ${post.platform}`,
        content: post.caption,
        storage_path: publicUrl,
        metadata: {
          provider: 'openai',
          model: imageModel,
          platform: post.platform,
          aspect_ratio: '1:1',
          mime_type: 'image/png',
          file_name: fileName,
          headline: post.headline,
          subheadline: post.subheadline,
          caption: post.caption,
          hashtags: post.hashtags,
          prompt: post.prompt,
          scheduled_at: scheduledAt,
        },
        status: 'draft',
        slide_order: i,
      })
      .select()
      .single();
    if (assetError) throw new Error(`Asset insert failed for ${post.title}: ${assetError.message}`);

    const { data: postRecord, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        project_id: projectId,
        campaign_id: campaign.id,
        campaign_asset_id: asset.id,
        status: 'scheduled',
        scheduled_at: scheduledAt,
      })
      .select()
      .single();
    if (postError) throw new Error(`Post insert failed for ${post.title}: ${postError.message}`);

    const socialAccountId = accountByPlatform.get(post.platform) || null;
    const { error: ppError } = await supabase
      .from('post_platforms')
      .insert({
        post_id: postRecord.id,
        social_account_id: socialAccountId,
        platform: post.platform,
        caption: post.caption,
        hashtags: post.hashtags,
        media_urls: [publicUrl],
        status: 'pending',
      });
    if (ppError) throw new Error(`Post platform insert failed for ${post.title}: ${ppError.message}`);

    created.push({ title: post.title, platform: post.platform, scheduledAt, imageUrl: publicUrl });
  }

  await supabase.from('pipeline_jobs').insert({
    project_id: projectId,
    user_id: userId,
    campaign_id: campaign.id,
    job_type: 'content_calendar',
    status: 'completed',
    current_step: 'Complete',
    total_posts: posts.length,
    completed_posts: posts.length,
    metadata: {
      provider: 'openai',
      model: imageModel,
      total_generated: posts.length,
      total_failed: 0,
      warnings: accounts?.length ? [] : ['Posts are scheduled in MarketPilot, but no active social account connection was found for one or more platforms.'],
    },
  });

  console.log(JSON.stringify({
    campaignId: campaign.id,
    campaignName,
    createdCount: created.length,
    firstScheduledAt: created[0]?.scheduledAt,
    lastScheduledAt: created.at(-1)?.scheduledAt,
    campaignUrl: `https://marketpilot-one.vercel.app/dashboard/${projectId}/campaigns/${campaign.id}`,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
