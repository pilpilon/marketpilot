import fs from 'node:fs';
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] ||= value;
  }
}
loadEnv();

const projectId = 'f76c7004-14b0-4360-bccb-84424f71fb33';
const oldCampaignId = 'c62cfb33-4761-420c-b8c4-e3fb7e2784dc';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

const screenshots = {
  gmail: 'C:/Users/Aorus/Documents/restaurant/marketing/screenshots/gmail.png',
  reports: 'C:/Users/Aorus/Documents/restaurant/marketing/screenshots/reports.png',
  inventory: 'C:/Users/Aorus/Documents/restaurant/marketing/screenshots/inventory.png',
  suppliers: 'C:/Users/Aorus/Documents/restaurant/marketing/screenshots/suppliers.png',
  cookbook: 'C:/Users/Aorus/Documents/restaurant/marketing/screenshots/cookbook.png',
  logo: 'C:/Users/Aorus/Documents/restaurant/marketing/Logo/BestRest-logo-transparent-cropped.png',
};

const posts = [
  ['gmail','instagram','חשבונית אחת. 90 שניות.','BestRest קוראת חשבוניות ספקים ומוציאה פריטים, כמויות ומחירים.','נמאס להקליד חשבוניות ספקים ידנית? BestRest מחברת Gmail, מאתרת חשבוניות ומתחילה להפוך אותן לנתונים שאפשר לעבוד איתם — פריטים, כמויות, מחירים והתראות על חריגות.','restaurant owner in a real Tel Aviv cafe office, morning light, authentic Israeli restaurant workday, no screens, no readable papers'],
  ['reports','facebook','מי העלה לך מחיר?','השוואת ספקים שמראה שינויי מחיר לפני סוף החודש.','העלאות מחיר קטנות על שמן, גבינה או ירקות יכולות למחוק רווח. BestRest מרכזת חשבוניות ומציפה שינויי מחירים כדי שתדע איפה לבדוק ולמי להתקשר.','restaurant procurement desk with fresh vegetables, delivery crates, chef checking paperwork, ultra realistic documentary photo'],
  ['inventory','instagram','המלאי מתחיל בחשבונית','מה שנכנס למטבח הופך לנתוני מלאי ועלות.','כשחשבוניות מסודרות, גם המלאי והפוד קוסט מתחילים להיות ברורים יותר. BestRest מחברת בין ספקים, חשבוניות, פריטים ועלויות.','restaurant stock room with organized shelves, fresh produce boxes, chef apron, natural light, ultra realistic'],
  ['gmail','facebook','Gmail מחפש. AI בודק.','חשבוניות מהמייל עוברות לבדיקה לפני כניסה למלאי.','לא עוד קבצים מפוזרים במיילים. BestRest נבנית כדי למצוא חשבוניות ספקים, לחלץ נתונים ולהציג מה דורש בדיקה לפני שזה פוגע ברווחיות.','small restaurant office, inbox workflow mood, owner reviewing printed delivery note, photorealistic'],
  ['suppliers','instagram','הספק יקר? תראה מספרים','השוואה בין ספקים לפי פריטים, לא לפי תחושה.','בעלי מסעדות לא צריכים לנחש מי באמת יקר. עם נתונים מחשבוניות אפשר להשוות פריטים, ספקים ושינויים לאורך זמן.','restaurant owner comparing supplier deliveries, crates from two vendors, realistic Israeli market feel'],
  ['reports','facebook','סוף חודש בלי מרדף','דוחות חשבוניות ועלויות שמוכנים לבדיקה.','סוף חודש לא חייב להיות איסוף ידני של חשבוניות, מחירים ושאלות לרואה החשבון. BestRest עוזרת להפוך את הנתונים למסודרים יותר.','calm end of month restaurant office, organized receipts, accountant meeting in cafe, realistic'],
  ['cookbook','instagram','כמה באמת עולה מנה?','חבר מתכונים, מלאי וחשבוניות כדי להבין רווחיות.','אם חומרי הגלם מתייקרים, מחיר המנה משתנה גם אם התפריט לא. BestRest מכוונת לחבר בין חשבוניות, מתכונים ועלות מנה.','chef plating dish in professional kitchen, ingredients nearby, realistic premium food photography'],
  ['reports','facebook','אל תגלה בדיעבד','חריגות מחיר מופיעות בזמן שהן עוד ניתנות לטיפול.','הפער בין “בערך בסדר” לבין שליטה אמיתית נמצא בפרטים הקטנים: מחיר פריט, שינוי מספק, חשבונית חריגה. BestRest מציפה את זה מוקדם יותר.','restaurant manager looking serious at supplier delivery note in kitchen, cinematic realistic'],
  ['gmail','instagram','חשבוניות לא צריכות להיעלם','כל חשבונית ספק במקום אחד, מוכנה לבדיקה.','PDF במייל, צילום בוואטסאפ, חשבונית מספק — הכול נוטה להתפזר. BestRest שואפת להפוך את התהליך למסודר וברור.','messy restaurant back office but realistic, paper stacks, coffee, calculator, warm light, no readable text'],
  ['inventory','facebook','פחות הקלדה. יותר שליטה.','AI עוזר להכניס נתוני ספקים למערכת בצורה חכמה.','הבעיה היא לא רק הזמן של ההקלדה — אלא טעויות, פספוסים וחוסר שליטה. BestRest נועדה לצמצם עבודה ידנית ולתת תמונה טובה יותר לעסק.','busy restaurant kitchen manager with tablet but screen blank, invoices on counter, ultra realistic'],
  ['suppliers','instagram','המחיר עלה בשקט?','BestRest עוזרת לזהות שינוי לפני שהוא הופך להפסד.','גם עלייה של כמה אגורות בפריט קבוע יכולה להצטבר. כשיש מעקב חשבוניות, אפשר לראות מגמות ולא רק להרגיש אותן בקופה.','close-up of restaurant supplier delivery, produce, hand holding receipt, realistic shallow depth of field'],
  ['reports','facebook','רואה החשבון יודה לך','נתונים נקיים יותר מתוך חשבוניות ספקים.','כשהמידע מגיע מסודר, קל יותר להבין הוצאות, לבדוק חריגות ולהכין את העסק לסוף חודש. BestRest בונה שכבת נתונים מעל החשבוניות שלך.','accountant and restaurant owner reviewing documents in cafe, realistic professional'],
  ['gmail','instagram','מחפשים מסעדות לפיילוט','בדיקה על חשבוניות אמיתיות מהעסק שלך.','אנחנו מחפשים בעלי מסעדות ובתי קפה שרוצים לבדוק את BestRest על חשבוניות אמיתיות. אם חשבוניות, ספקים ופוד קוסט הם כאב אצלך — זה הזמן לדבר.','optimistic Israeli cafe owner opening laptop in real cafe, startup pilot vibe, photorealistic'],
  ['reports','facebook','תתחיל מחשבונית אחת','נראה יחד אילו תובנות BestRest מצליחה לחלץ.','הדרך הכי טובה לבדוק התאמה: חשבונית ספק אחת. נבחן פריטים, מחירים, ספקים ושינויים — ונראה אם BestRest יכולה לחסוך לך זמן וכסף.','confident restaurant owner at wooden table with clean paperwork, warm restaurant background, realistic'],
].map((p, i) => ({
  screenshot: p[0], platform: p[1], hook: p[2], sub: p[3], caption: p[4], bg: p[5],
  title: `${i+1}. ${p[2]}`, hashtags: ['BestRest','מסעדות','ניהולמסעדה','חשבוניותספקים','FoodCost'],
}));

function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function splitHebrew(s, max=19){const words=s.split(' '); const lines=[]; let cur=''; for(const w of words){if((cur+' '+w).trim().length>max){if(cur) lines.push(cur); cur=w;}else cur=(cur+' '+w).trim();} if(cur) lines.push(cur); return lines.slice(0,3);}

async function makeInvoiceBuffer(i){
  const suppliers=['הטרוריה יצחקי דוד בע״מ','שוק הגולן בע״מ','מחלבות הצפון בע״מ','ירקני השרון בע״מ'];
  const items=[['עגבניות מובחרות','24 ק״ג','₪168.00'],['שמן קנולה','12 יח׳','₪342.00'],['גבינת מוצרלה','8 ק״ג','₪296.00'],['חסה טרייה','30 יח׳','₪135.00']];
  const rows=items.map((r,idx)=>`<text x="690" y="${282+idx*44}" text-anchor="end" class="row">${esc(r[0])}</text><text x="390" y="${282+idx*44}" text-anchor="middle" class="row">${r[1]}</text><text x="170" y="${282+idx*44}" text-anchor="middle" class="row">${r[2]}</text>`).join('');
  const svg=`<svg width="760" height="980" viewBox="0 0 760 980" xmlns="http://www.w3.org/2000/svg" direction="rtl">
  <style>.h{font-family:Arial,sans-serif;font-size:42px;font-weight:800;fill:#111827}.m{font-family:Arial,sans-serif;font-size:27px;font-weight:700;fill:#1f2937}.row{font-family:Arial,sans-serif;font-size:25px;fill:#111827}.s{font-family:Arial,sans-serif;font-size:20px;fill:#4b5563}</style>
  <rect width="760" height="980" rx="24" fill="#fff"/><rect x="34" y="34" width="692" height="912" rx="18" fill="#fff" stroke="#d1d5db" stroke-width="3"/>
  <text x="690" y="96" text-anchor="end" class="h">חשבונית מס / קבלה</text><text x="690" y="140" text-anchor="end" class="m">${suppliers[i%suppliers.length]}</text><text x="690" y="176" text-anchor="end" class="s">ח.פ. 516${String(200000+i*137).slice(0,6)} • הזמנה ${8400+i}</text>
  <line x1="70" x2="690" y1="220" y2="220" stroke="#9ca3af" stroke-width="2"/><text x="690" y="248" text-anchor="end" class="m">פריט</text><text x="390" y="248" text-anchor="middle" class="m">כמות</text><text x="170" y="248" text-anchor="middle" class="m">סה״כ</text>${rows}
  <line x1="70" x2="690" y1="486" y2="486" stroke="#d1d5db" stroke-width="2"/><text x="690" y="544" text-anchor="end" class="m">סה״כ לפני מע״מ</text><text x="170" y="544" text-anchor="middle" class="m">₪941.00</text><text x="690" y="590" text-anchor="end" class="m">מע״מ</text><text x="170" y="590" text-anchor="middle" class="m">₪159.97</text><text x="690" y="660" text-anchor="end" class="h">לתשלום</text><text x="170" y="660" text-anchor="middle" class="h">₪1,100.97</text>
  <rect x="70" y="728" width="620" height="104" rx="18" fill="#ecfdf5" stroke="#10b981"/><text x="660" y="772" text-anchor="end" class="m" fill="#065f46">BestRest זיהתה:</text><text x="660" y="812" text-anchor="end" class="s">3 פריטים עם שינוי מחיר מול חודש קודם</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function hookOverlay(post){
  const lines=splitHebrew(post.hook, 15);
  // Use centered Hebrew text inside the card. This avoids librsvg clipping RTL text when text-anchor=end is used near the right edge.
  const hookText=lines.map((l,idx)=>`<text x="716" y="${118+idx*64}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" class="hook">${esc(l)}</text>`).join('');
  const subLines=splitHebrew(post.sub, 30);
  const subText=subLines.map((l,idx)=>`<text x="716" y="${144+lines.length*64+idx*38}" text-anchor="middle" direction="rtl" unicode-bidi="plaintext" class="sub">${esc(l)}</text>`).join('');
  return Buffer.from(`<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617" stop-opacity=".24"/><stop offset="1" stop-color="#020617" stop-opacity=".66"/></linearGradient></defs>
    <style>.hook{font-family:Arial,sans-serif;font-size:56px;font-weight:900;fill:#fff}.sub{font-family:Arial,sans-serif;font-size:29px;font-weight:700;fill:#d1fae5}.pill{font-family:Arial,sans-serif;font-size:25px;font-weight:800;fill:#07111f}</style>
    <rect width="1080" height="1080" fill="url(#g)"/>
    <rect x="54" y="46" width="228" height="58" rx="29" fill="#16c784"/><text x="168" y="84" text-anchor="middle" class="pill">BestRest</text>
    <rect x="388" y="52" width="656" height="${lines.length*64+subLines.length*38+72}" rx="30" fill="#020617" fill-opacity=".70"/>${hookText}${subText}
  </svg>`);
}

async function makeComposite(bg, post, i){
  const screenshotPath=screenshots[post.screenshot];
  const screenshot=await sharp(screenshotPath).resize({width:720, withoutEnlargement:true}).png().toBuffer();
  const invoice=await sharp(await makeInvoiceBuffer(i)).resize({width:320}).rotate(-6,{background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const shadow=Buffer.from(`<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg"><rect x="58" y="600" width="816" height="430" rx="28" fill="#000" opacity=".35"/><rect x="704" y="465" width="320" height="420" rx="22" fill="#000" opacity=".24"/></svg>`);
  return sharp(bg).resize(1080,1080,{fit:'cover'}).composite([
    {input: shadow, top:0,left:0},
    {input: screenshot, top:604, left:64},
    {input: invoice, top:454, left:704},
    {input: hookOverlay(post), top:0, left:0},
  ]).png({quality:94}).toBuffer();
}

function nextNoonUTC(dayOffset){const d=new Date(); d.setUTCDate(d.getUTCDate()+dayOffset); d.setUTCHours(9,0,0,0); return d.toISOString();}

async function main(){
  console.log(`Using OpenAI image model ${imageModel} with quality=high for background generation`);
  const {data:project,error:projectError}=await supabase.from('projects').select('id,user_id,name').eq('id',projectId).single(); if(projectError) throw projectError;
  const userId=project.user_id;
  const campaignName=`BestRest 2-Week Hebrew Premium Calendar — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
  const {data:campaign,error:campaignError}=await supabase.from('campaigns').insert({project_id:projectId,user_id:userId,name:campaignName,campaign_type:'content_marketing',platforms:['instagram','facebook'],status:'active',goal:'Hebrew-first ultra-realistic BestRest pilot lead generation using real product screenshots and invoice visuals.',metadata:{provider:'openai',model:imageModel,quality:'high',replacement_for:oldCampaignId}}).select().single(); if(campaignError) throw campaignError;
  const {data:accounts}=await supabase.from('social_accounts').select('id,platform').eq('project_id',projectId).eq('user_id',userId).eq('status','active'); const accountByPlatform=new Map((accounts||[]).map(a=>[a.platform,a.id]));
  const created=[];
  for(let i=0;i<posts.length;i++){
    const post=posts[i];
    console.log(`Generating premium ${i+1}/${posts.length}: ${post.hook}`);
    const image=await openai.images.generate({model:imageModel, prompt:`Ultra realistic editorial advertising photo, ${post.bg}. Israeli restaurant/cafe context, authentic human atmosphere, premium DSLR photography, natural light, shallow depth of field, NOT illustration, NOT cartoon, NOT 3D render, NOT AI dashboard, no laptop screen with charts, no mobile screen UI, no readable text, no logos, no fake invoices. Leave room for product screenshot and invoice compositing.`, size:'1024x1024', quality:'high', n:1});
    const b64=image.data?.[0]?.b64_json; if(!b64) throw new Error('No image returned');
    const finalPng=await makeComposite(Buffer.from(b64,'base64'),post,i);
    const slug=post.hook.replace(/\s+/g,'-').replace(/["'״׳.,!?]/g,'').slice(0,80);
    const fileName=`${userId}/${projectId}/${Date.now()}-${i+1}-premium-${crypto.randomUUID()}.png`;
    const {error:uploadError}=await supabase.storage.from('generated-images').upload(fileName,finalPng,{contentType:'image/png',upsert:false}); if(uploadError) throw uploadError;
    const {data:urlData}=supabase.storage.from('generated-images').getPublicUrl(fileName);
    const scheduledAt=nextNoonUTC(i+1);
    const {data:asset,error:assetError}=await supabase.from('campaign_assets').insert({campaign_id:campaign.id,user_id:userId,asset_type:'template_render',title:`${post.hook} — ${post.platform}`,content:post.caption,storage_path:urlData.publicUrl,metadata:{provider:'openai',model:imageModel,quality:'high',platform:post.platform,language:'he',headline:post.hook,subheadline:post.sub,caption:post.caption,hashtags:post.hashtags,uses_real_bestrest_screenshot:post.screenshot,uses_realistic_invoice_overlay:true,background_prompt:post.bg,media_url:urlData.publicUrl,scheduled_at:scheduledAt},status:'draft',slide_order:i}).select().single(); if(assetError) throw assetError;
    const {data:postRecord,error:postError}=await supabase.from('posts').insert({user_id:userId,project_id:projectId,campaign_id:campaign.id,campaign_asset_id:asset.id,status:'scheduled',scheduled_at:scheduledAt}).select().single(); if(postError) throw postError;
    const {error:ppError}=await supabase.from('post_platforms').insert({post_id:postRecord.id,social_account_id:accountByPlatform.get(post.platform)||null,platform:post.platform,caption:post.caption,hashtags:post.hashtags,media_urls:[urlData.publicUrl],status:'pending'}); if(ppError) throw ppError;
    created.push({title:post.hook,platform:post.platform,scheduledAt,imageUrl:urlData.publicUrl});
  }
  await supabase.from('pipeline_jobs').insert({project_id:projectId,user_id:userId,campaign_id:campaign.id,job_type:'content_calendar',status:'completed',current_step:'Complete',total_posts:posts.length,completed_posts:posts.length,metadata:{provider:'openai',model:imageModel,quality:'high',total_generated:posts.length,total_failed:0,replacement_for:oldCampaignId}});
  console.log(JSON.stringify({campaignId:campaign.id,campaignName,createdCount:created.length,firstScheduledAt:created[0]?.scheduledAt,lastScheduledAt:created.at(-1)?.scheduledAt,firstImage:created[0]?.imageUrl,campaignUrl:`https://marketpilot-one.vercel.app/dashboard/${projectId}/campaigns/${campaign.id}`},null,2));
}
main().catch(e=>{console.error(e?.message||e); process.exit(1);});
