/* Word lists the keyword reader leans on. Split out so the reader itself is
   readable, and so each list can be argued with on its own terms. */

export const STOP = (
  "a about above after again against all am an and any are as at be because been before being below between both but by " +
  "can did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its " +
  "just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their " +
  "them then there these they this those through to too under until up very was we were what when where which while who whom why will " +
  "with you your role team work working experience years ability strong excellent including etc must plus using use used " +
  "across within also new well help support ensure drive great good high right able hiring hire looking seeking join joining " +
  "requirements required requirement requires require requiring responsibilities responsibility nice want wants need needs needed reads read write " +
  "writes build builds built lead leads leading own owns owning comfort comfortable similar tooling tools someone person candidate " +
  "candidates apply application applicants company companies will would could may might actually"
).split(" ");

export const PHRASE = [
  "paid social", "paid media", "media buying", "landing page", "conversion rate", "design system",
  "design systems", "user research", "product design", "brand design", "content strategy",
  "content marketing", "email marketing", "project management", "data analysis", "customer success",
  "product marketing", "growth marketing", "performance marketing", "social media", "motion design",
  "front end", "back end", "full stack", "machine learning", "supply chain", "financial modeling",
  "stakeholder management", "account management", "business development", "quality assurance",
  "change management", "process improvement", "a b testing",
];

/* Tools, platforms and disciplines. A term on this list is a real requirement
   even when the posting says it exactly once, which is the normal case.

   Deliberately NOT here: next, make, ghost, sanity, heap, segment, less, vite,
   node, moz, notion, native, display, api, sql. Each is a real product name and
   also an ordinary English word, and in a marketing posting the ordinary
   reading is the common one. A false skill is worse than a missing one,
   because it reaches the core list and then reads as a gap. */
export const SKILLVOCAB = (
  "figma sketch photoshop illustrator indesign aftereffects premiere canva framer webflow wordpress woocommerce " +
  "shopify hubspot salesforce marketo klaviyo mailchimp braze iterable pardot squarespace wix drupal contentful sanity strapi " +
  "bricks elementor kadence divi gohighlevel clickfunnels unbounce optimizely vwo hotjar mixpanel amplitude " +
  "looker tableau powerbi ga4 analytics adwords semrush ahrefs screamingfrog rankmath yoast " +
  "html css javascript typescript react vue svelte nuxt nodejs php python ruby graphql json liquid hubl handlebars " +
  "jquery gsap greensock tailwind bootstrap sass webpack git github gitlab bitbucket jira asana trello airtable " +
  "zapier n8n retool figjam miro storybook " +
  "seo sem aeo geo cro ppc ux ui saas b2b b2c dtc ecommerce cms crm cdp esp mmp roas cac ltv cpa cpc ctr aov mql sql sqo arr mrr " +
  "accessibility wcag aria responsive wireframe prototype usability heuristic typography branding identity " +
  "copywriting storytelling positioning messaging segmentation personalization localisation localization " +
  "attribution incrementality experimentation lifecycle retention acquisition activation onboarding churn funnel " +
  "paid organic inbound outbound influencer affiliate programmatic display native " +
  "schema jsonld sitemap canonical indexation crawl backlink " +
  "scrum agile kanban sprint roadmap stakeholder"
).split(" ");

export const SKILLSET: Record<string, 1> = {};
SKILLVOCAB.forEach((w) => {
  SKILLSET[w] = 1;
});

/* Words that survive the stop list but say nothing about a skill. Demoted, not
   removed, because seeing them in the gap list is occasionally useful. */
const FILLER = (
  "without one every run win partner employment experiences building program trust campaign making taking " +
  "looking growing scaling driving delivering ensuring managing owning leading working across within throughout " +
  "opportunity opportunities environment culture mission vision values benefits equal diversity inclusive inclusion " +
  "applicants applicant employer veteran disability compensation salary range bonus equity offer process interview " +
  "month months week weeks day days hour hours time full part flexible hybrid onsite remote office location " +
  "please note visit learn read apply click here below above following " +
  "rather instead therefore however moreover furthermore whether either neither both each any all " +
  "way ways thing things something anything everything someone anyone everyone"
).split(" ");

export const FILLERSET: Record<string, 1> = {};
FILLER.forEach((w) => {
  FILLERSET[w] = 1;
});

/* Seniority and generic title nouns. These ride in on the job-title bonus and
   reach the core list, where "senior" then scores as a match against every
   resume line that happens to say Senior. Rank signal, not skill signal. */
export const TITLEGENERIC: Record<string, 1> = {};
(
  "senior junior staff principal lead leads manager managers director head associate assistant " +
  "specialist coordinator officer chief vice president intern trainee level mid entry " +
  "full part time position job opening vacancy req"
)
  .split(" ")
  .forEach((w) => {
    TITLEGENERIC[w] = 1;
  });

/* Header lines that open a section that actually states requirements. */
export const REQ_HEAD =
  /(what you.{0,20}(do|bring|ll own)|responsibilit|requirement|qualification|you.{0,3}ll|about the role|the role|skills|experience with|must have|nice to have|who you are|what we.{0,10}looking)/i;
export const SOFT_HEAD =
  /(about (us|the company|webflow|the team)|benefits|perks|compensation|equal opportunity|eeo|diversity|our (mission|values|culture)|why join|how we work|application (information|process)|privacy)/i;

/* Skills come back from the model in whatever case the posting used, which is
   usually all lower. A recruiter reads the skills line first and an all
   lowercase one reads as sloppy, so proper nouns are restored. */
export const SKILL_CASE: Record<string, string> = {
  wordpress: "WordPress", woocommerce: "WooCommerce", javascript: "JavaScript",
  typescript: "TypeScript", html: "HTML", css: "CSS", sql: "SQL", seo: "SEO", sem: "SEM",
  hubspot: "HubSpot", "google analytics": "Google Analytics", ga4: "GA4", "meta ads": "Meta Ads",
  linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", github: "GitHub", gitlab: "GitLab",
  figma: "Figma", webflow: "Webflow", shopify: "Shopify", klaviyo: "Klaviyo", mailchimp: "Mailchimp",
  salesforce: "Salesforce", aws: "AWS", gcp: "GCP", api: "API", apis: "APIs", ui: "UI", ux: "UX",
  "ui/ux": "UI/UX", saas: "SaaS", b2b: "B2B", b2c: "B2C", crm: "CRM", cms: "CMS", kpi: "KPIs",
  roi: "ROI", roas: "ROAS", ppc: "PPC", ctr: "CTR", "a/b testing": "A/B testing", ios: "iOS",
  nodejs: "Node.js", "node.js": "Node.js", react: "React", python: "Python", java: "Java",
  kubernetes: "Kubernetes", docker: "Docker", jira: "Jira", notion: "Notion", asana: "Asana",
};

export function prettySkill(s: string): string {
  const k = String(s || "").trim().toLowerCase();
  if (SKILL_CASE[k]) return SKILL_CASE[k];
  /* Leave anything the user or the posting capitalised deliberately. */
  if (/[A-Z]/.test(s)) return s;
  return k.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/* A gap is only worth asking about if it names something. Generic verbs and
   filler survive the keyword pass often enough that the wizard was opening
   with "Do you have experience with requires?" */
export const NOT_A_SKILL =
  /^(also|able|across|team|teams|role|roles|year|years|plus|strong|good|great|help|helps|drive|drives|own|owns|join|joins|work|works|working|include|includes|including|etc|new|well|more|most|best|like|likes|make|makes|take|takes|give|gives|come|comes|know|knows|look|looks|find|finds|show|shows|keep|keeps|move|moves|turn|turns|part|full|time|day|days|week|weeks|month|months)$/i;
