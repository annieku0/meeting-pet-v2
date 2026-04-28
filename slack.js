/* ── slack.js ── Synko Slack Workspace Simulator ── */

// ── Read URL params ──────────────────────────────────────────────────────────
const params      = new URLSearchParams(window.location.search);
const PET_INDEX   = parseInt(params.get('petIndex') ?? '0', 10);
const PET_NAME    = params.get('petName') || 'Buddy';

// ── Teammates ────────────────────────────────────────────────────────────────
const TEAMMATES = {
  Lesley: { avatar: 'L', color: '#C060FF' },
  Steve:  { avatar: 'S', color: '#FFD040' },
  Alex:   { avatar: 'A', color: '#40E080' },
};

// ── Channel data ─────────────────────────────────────────────────────────────
const CHANNELS = {
  general: {
    name: '# general',
    topic: 'Team announcements and watercooler chat',
    messages: [
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '8:58 AM', text: 'Good morning everyone! 👋 Quick heads-up — Q3 campaign brief is due this Friday.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '9:00 AM', text: 'Thanks for the reminder. Do we have a shared doc for it yet?' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '9:01 AM', text: 'Yes! I dropped the link in #marketing yesterday. Alex, you\'re handling the visuals section, right?' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', time: '9:02 AM', text: 'Yep, I\'ve already got the hero banner done. Will add the rest of the assets by Thursday noon.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '9:04 AM', text: 'Nice. Someone should handle the copy review section — it\'s still empty.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '9:06 AM', text: 'Also, the client wants a status email before EOD. Who can send that?' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '9:08 AM', text: 'I can draft it. @You, can you review it before I send? Takes 5 mins.' },
    ],
    // Auto-replies triggered after the user sends a message
    replies: [
      { user: 'Lesley', avatar: 'L', color: '#C060FF', delay: 2200, text: 'Thanks for jumping in! Let us know when it\'s done so we can mark it off.' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', delay: 4500, text: 'Appreciate it 🙌 I\'ll make sure my design section is ready before your copy review is done.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', delay: 7000, text: 'Great. I\'ll send you the draft email in a DM once it\'s ready.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', delay: 11000, text: 'Awesome team 💪 Let\'s aim to have everything wrapped by Thursday so Friday is just final checks.' },
    ],
  },

  marketing: {
    name: '# marketing',
    topic: 'Q3 campaign planning, briefs, and assets',
    messages: [
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '8:30 AM', text: 'Morning team! I\'ve opened up the Q3 brief doc. Here\'s the link: [Q3_Campaign_Brief.gdoc]' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', time: '8:32 AM', text: 'Got it, opening now. Looks like the social copy section is still blank.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '8:34 AM', text: 'Yeah, that\'s the main gap. Has anyone started on it?' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '8:36 AM', text: 'Not yet. I can do it.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '8:37 AM', text: 'Perfect. Steve, can you have a first draft by Wednesday noon? That gives us time to review before Friday.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '8:38 AM', text: 'Wednesday noon works. I\'ll post a link in this channel when it\'s ready.' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', time: '8:40 AM', text: 'Also — the budget doc still shows last quarter\'s numbers. Someone needs to update it before we share with the client.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '8:42 AM', text: '@You — are you able to take the budget update? You have the latest numbers from the finance sync.' },
    ],
    replies: [
      { user: 'Lesley', avatar: 'L', color: '#C060FF', delay: 2000, text: 'Great, thank you! Once the budget is updated, I\'ll send it to finance for sign-off.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', delay: 4000, text: 'Perfect. I\'ll make sure the copy aligns with whatever figures are in the doc.' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', delay: 6500, text: 'I\'ll start on the visuals once the copy draft is in — should be a smooth hand-off 🎨' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', delay: 10000, text: 'This is great progress. Let\'s do a quick async check-in here Thursday morning before the final push.' },
    ],
  },

  design: {
    name: '# design',
    topic: 'Mockups, assets, and creative direction',
    messages: [
      { user: 'Alex',   avatar: 'A', color: '#40E080', time: '9:45 AM', text: 'Hey team! I\'ve uploaded the updated banner mockups to Figma — three variations. Link: [Figma_Q3_Banners]' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '9:48 AM', text: 'Oh these look really clean! I love variation B the most.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '9:50 AM', text: 'Agreed, B is strong. The typography feels more on-brand than A.' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', time: '9:51 AM', text: 'Glad you like it! @You — what do you think? You\'ve seen the client brand guidelines most recently.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '9:54 AM', text: 'Also — someone should present these to the client on Friday. They want to see the direction before we finalize.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '9:55 AM', text: 'I can join the call but I\'d rather Alex walk them through it since she designed it.' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', time: '9:56 AM', text: 'Happy to! I\'ll prep a quick 5-slide deck with rationale. @You, can you add the copy context slides?' },
    ],
    replies: [
      { user: 'Alex',   avatar: 'A', color: '#40E080', delay: 1800, text: 'Great feedback! I\'ll move forward with variation B then.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', delay: 3500, text: 'Perfect. I\'ll book the Friday client call for 10 AM and send invites to everyone.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', delay: 6000, text: 'I\'ll have the copy rationale ready by Thursday EOD so you can include it in the deck.' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', delay: 9000, text: 'This is coming together nicely 🎉 I\'ll share the final deck in this channel before the call.' },
    ],
  },

  dev: {
    name: '# dev',
    topic: 'Engineering, sprints, and deployments',
    messages: [
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '10:55 AM', text: 'Hey devs — PR #42 is up for review. It\'s the analytics event fix we discussed Monday.' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', time: '10:58 AM', text: 'On it! I\'ll review by 2 PM and leave inline comments.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '10:59 AM', text: 'Thanks Alex. There\'s one tricky bit around the event batching — left a note in the PR description.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '11:02 AM', text: 'Also flagging — staging is still on last week\'s build. Do we have a deployment window today?' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', time: '11:04 AM', text: 'I was planning 3 PM if PR #42 is merged by then. Does that work for everyone?' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', time: '11:05 AM', text: 'I\'ll prioritise the review to make sure it\'s merged well before 3. Should be fine.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '11:07 AM', text: '@You — are you able to run the 3 PM staging deployment while Steve monitors the logs?' },
    ],
    replies: [
      { user: 'Steve',  avatar: 'S', color: '#FFD040', delay: 2000, text: 'Awesome, thank you! I\'ll be on standby in this channel from 2:45 PM in case anything comes up.' },
      { user: 'Alex',   avatar: 'A', color: '#40E080', delay: 3800, text: 'I\'ll have PR #42 reviewed and approved by 1:30 PM so there\'s a clear runway.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', delay: 6500, text: 'Perfect. I\'ll update the staging checklist and post it here at 2:50 PM.' },
      { user: 'Steve',  avatar: 'S', color: '#FFD040', delay: 10000, text: 'Great coordination everyone 🚀 Let\'s post a deployment confirmed message here once it\'s live.' },
    ],
  },

  'dm-lesley': {
    name: 'Lesley',
    topic: 'Direct message',
    messages: [
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '8:15 AM', text: 'Hey! Hope you had a good weekend 😊' },
      { user: 'You',    avatar: '▸', color: '#C060FF', time: '8:20 AM', text: 'Hey! Yeah it was great, thanks. Ready for the Q3 push this week?' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '8:21 AM', text: 'Ha, as ready as I\'ll ever be 😅 Quick thing — the client asked for a status email by EOD today. Would you be able to review Steve\'s draft before it goes out?' },
      { user: 'You',    avatar: '▸', color: '#C060FF', time: '8:25 AM', text: 'Sure, I\'ll take a look.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', time: '8:26 AM', text: 'Amazing, thank you. Steve should have the draft ready by noon. I\'ll have him send it your way.' },
    ],
    replies: [
      { user: 'Lesley', avatar: 'L', color: '#C060FF', delay: 2000, text: 'Perfect! Also — just a heads up, the client specifically asked about the timeline for the banner designs. Might be worth looping in Alex.' },
      { user: 'Lesley', avatar: 'L', color: '#C060FF', delay: 8000, text: 'Thanks again for all your help this week. This launch wouldn\'t be possible without the team 🙏' },
    ],
  },

  'dm-steve': {
    name: 'Steve',
    topic: 'Direct message',
    messages: [
      { user: 'Steve', avatar: 'S', color: '#FFD040', time: '9:30 AM', text: 'Hey — did you get a chance to look at the Q3 brief yet?' },
      { user: 'You',   avatar: '▸', color: '#C060FF', time: '9:35 AM', text: 'Not yet, been in back-to-back meetings. I\'ll get to it.' },
      { user: 'Steve', avatar: 'S', color: '#FFD040', time: '9:36 AM', text: 'No worries, no huge rush — just want to make sure the copy section is aligned before I write the social posts.' },
      { user: 'Steve', avatar: 'S', color: '#FFD040', time: '9:38 AM', text: 'Also I\'m drafting the client status email now. Can I run it by you before I send?' },
    ],
    replies: [
      { user: 'Steve', avatar: 'S', color: '#FFD040', delay: 2500, text: 'Appreciate it! I\'ll send you the draft as soon as it\'s ready. Probably around noon.' },
      { user: 'Steve', avatar: 'S', color: '#FFD040', delay: 7000, text: 'One more thing — do you know if Lesley wants us to CC the client\'s PM on the email or just the main contact?' },
    ],
  },

  'dm-alex': {
    name: 'Alex',
    topic: 'Direct message',
    messages: [
      { user: 'Alex', avatar: 'A', color: '#40E080', time: '10:10 AM', text: 'Hey! I just shared the new mockups in #design — would love your take on them when you have a moment 🎨' },
      { user: 'You',  avatar: '▸', color: '#C060FF', time: '10:15 AM', text: 'Ooh exciting! I\'ll check them out now.' },
      { user: 'Alex', avatar: 'A', color: '#40E080', time: '10:16 AM', text: 'Variation B is my personal favourite but I want a second opinion before I pitch it to the client 😄' },
      { user: 'You',  avatar: '▸', color: '#C060FF', time: '10:18 AM', text: 'I agree with B! The typography is much cleaner.' },
      { user: 'Alex', avatar: 'A', color: '#40E080', time: '10:19 AM', text: 'Yes!! Okay cool, that settles it. I\'ll move forward with B. Thanks for the sanity check 🙌' },
    ],
    replies: [
      { user: 'Alex', avatar: 'A', color: '#40E080', delay: 2000, text: 'Love it! Also — do you happen to have the updated brand colour hex codes? I want to double-check the banner matches the new palette.' },
      { user: 'Alex', avatar: 'A', color: '#40E080', delay: 7500, text: 'No worries if not, I\'ll ask Lesley. Thanks again!' },
    ],
  },
};

// ── Message example lookup table ─────────────────────────────────────────────
// Each entry: { match (substring to detect), type, suggestion }
// The pet checks the user's message against every `match` string (case-insensitive).
// Add new rows here to teach the pet more patterns.
// MESSAGE_EXAMPLES kept as a reference list but detection is now handled by
// the smarter pattern engine below. See analyzeText().
const MESSAGE_EXAMPLES = [

  // ── VAGUE COMMITMENT ───────────────────────────────────────────────────────
  { match: "i'll handle it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll handle the client email — I'll send it to Sarah by Thursday EOD and CC the team in #general." },

  { match: "i'll take care of it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll take care of the marketing draft — I'll submit it to Lesley by Friday at 5 PM." },

  { match: "sure, i'll finish it",
    type: 'VAGUE COMMITMENT',
    suggestion: "Sure, I'll submit the Q3 campaign brief to Lesley by Friday at 5 PM." },

  { match: "i'll finish it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll finish the copy review — I'll post the updated doc in #marketing by Wednesday noon." },

  { match: "i'll get it done",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll get the visuals approved — I'll send them to Lesley for sign-off by Friday morning." },

  { match: "i'll do it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll do it — specifically, I'll [describe task] and share the result in this channel by [date]." },

  { match: "i can do it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I can do it — I'll write the social copy and post a first draft in the shared doc by Thursday EOD." },

  { match: "i'll sort it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll sort out the budget doc — I'll have the updated version in Google Drive by Tuesday at noon and share the link here." },

  { match: "i'll look into it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll look into the deployment issue — I'll post a findings summary in #dev by 4 PM today." },

  { match: "i'll look at it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll review PR #42 by 3 PM today and leave comments directly in GitHub." },

  { match: "i'll check it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll check the brief and share my feedback in this thread by Wednesday noon." },

  { match: "i'll check",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll check the brief and share my feedback in this thread by Wednesday noon." },

  { match: "i'll fix it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll fix the bug in PR #42 — I'll push the patch by 5 PM today and tag @Steve for re-review." },

  { match: "i'll send it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll send the updated deck to the team in #general by 3 PM today." },

  { match: "i'll send it over",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll send the deck over to Lesley and CC #marketing by 3 PM today." },

  { match: "i'll update it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll update the budget doc with the new figures — I'll share the link in #marketing by Tuesday noon." },

  { match: "i'll write it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll write the social copy — I'll post the first draft in the shared doc by Thursday EOD." },

  { match: "i'll submit it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll submit the form by Friday at 5 PM and share the confirmation screenshot here." },

  { match: "i'll complete it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll complete the Q3 brief and share the final version in #marketing by Friday EOD." },

  { match: "i'll follow up",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll follow up with the client by Wednesday at 10 AM and share their response in this thread." },

  { match: "i'll follow up on it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll follow up on the approval by Wednesday at 10 AM and report back here." },

  { match: "i'll reach out",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll reach out to the dev team by Tuesday and ask specifically about the staging timeline. I'll share their reply in #general." },

  { match: "i'll schedule it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll schedule the sync meeting for Wednesday 2–3 PM and send a calendar invite to everyone in this channel." },

  { match: "i'll get back to you",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll get back to you by tomorrow at noon with a clear answer on the budget." },

  { match: "i'll get back to you on that",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll get back to you on that by tomorrow at noon after checking with the design team." },

  { match: "leave it to me",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll own this — I'll complete the copy review by EOD and post a summary in #marketing." },

  { match: "i got it",
    type: 'VAGUE COMMITMENT',
    suggestion: "I've got this — I'll [describe specific task] and share the output in [channel] by [date/time]." },

  { match: "on it",
    type: 'VAGUE COMMITMENT',
    suggestion: "On it — I'll have [specific deliverable] ready by [date/time] and post it in this thread." },

  { match: "i'll handle the client",
    type: 'VAGUE COMMITMENT',
    suggestion: "I'll handle the client email — I'll send Sarah a status update by Thursday EOD and CC the team." },

  // ── VAGUE REFERRAL ─────────────────────────────────────────────────────────
  { match: "ask steve",
    type: 'VAGUE REFERRAL',
    suggestion: "Ask Steve (VP of Marketing) — he owns the campaign budget and can approve this. Tag @Steve in #marketing with your specific question." },

  { match: "ask lesley",
    type: 'VAGUE REFERRAL',
    suggestion: "Ask Lesley (Project Lead) — she owns the full project timeline. Tag @Lesley in this channel with your specific question." },

  { match: "ask alex",
    type: 'VAGUE REFERRAL',
    suggestion: "Ask Alex (Design Lead) — she owns all Figma files and brand assets. Reach out in #design with a specific request." },

  { match: "talk to steve",
    type: 'VAGUE REFERRAL',
    suggestion: "Talk to Steve (VP of Marketing) directly — DM him or post in #marketing: '@Steve, can you clarify [specific question]?'" },

  { match: "talk to lesley",
    type: 'VAGUE REFERRAL',
    suggestion: "Talk to Lesley (Project Lead) — tag @Lesley here and explain what you need so the whole team can see the answer." },

  { match: "talk to alex",
    type: 'VAGUE REFERRAL',
    suggestion: "Talk to Alex (Design Lead) in #design — tag @Alex and describe exactly what asset or feedback you need." },

  { match: "check with steve",
    type: 'VAGUE REFERRAL',
    suggestion: "Check with Steve (VP of Marketing) — post '@Steve, can you confirm the budget cap for Q3?' in #marketing so everyone has visibility." },

  { match: "check with lesley",
    type: 'VAGUE REFERRAL',
    suggestion: "Check with Lesley (Project Lead) on the deadline — tag @Lesley here so the whole team sees the answer." },

  { match: "check with alex",
    type: 'VAGUE REFERRAL',
    suggestion: "Check with Alex (Design Lead) in #design — tag @Alex and ask specifically which version of the mockup is final." },

  { match: "talk to the design team",
    type: 'VAGUE REFERRAL',
    suggestion: "Post in #design: '@Alex, can you confirm which mockup version is approved for the Q3 launch? We need this by Thursday.'" },

  { match: "check with the dev team",
    type: 'VAGUE REFERRAL',
    suggestion: "Post in #dev: '@Steve, what's the estimated staging deployment date? We need this to finalize the marketing timeline.'" },

  { match: "reach out to marketing",
    type: 'VAGUE REFERRAL',
    suggestion: "Post in #marketing: '@Lesley, can you confirm the campaign go-live date? Design needs this to schedule asset delivery.'" },

  // ── UNCLEAR OWNERSHIP ──────────────────────────────────────────────────────
  { match: "someone should handle",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], can you own this? Please complete [specific task] by [date] and post an update here." },

  { match: "someone should deal with",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], can you take this? I'd suggest completing the copy review by EOD and posting a summary in #marketing." },

  { match: "someone needs to",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], can you own this task? Please have it done by [date] and share the result in this channel." },

  { match: "someone can take",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], can you take this? Let us know by EOD if you're able to own it." },

  { match: "can someone take care of",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], are you available to take care of this? Please confirm by [time] so we can move forward." },

  { match: "can someone handle",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], can you handle this? I need a response by [date] so we don't block the team." },

  { match: "who's going to",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "Let's assign this now — @[name], can you own [specific task] and have it done by [date]?" },

  { match: "who is going to",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "Let's assign this now — @[name], can you own [specific task] and have it done by [date]?" },

  { match: "who's handling",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "Let's clarify ownership — @[name], can you confirm you're handling [task] by [date]?" },

  { match: "who is handling",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "Let's clarify ownership — @[name], can you confirm you're handling [task] by [date]?" },

  { match: "someone deal with it",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], can you deal with this? Please complete it by [date] and share an update here." },

  { match: "anyone want to",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], would you be able to own this? Please confirm by [time] so we can track it." },

  { match: "this needs to be done",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], can you take ownership of this? Please complete it by [date] and post a status update here." },

  { match: "this should be updated",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@[name], can you update this by [date]? Please share the updated version in this channel when done." },

  { match: "someone should present",
    type: 'UNCLEAR OWNERSHIP',
    suggestion: "@Alex, could you present the mockups in Friday's review? You're most familiar with the design decisions." },

  // ── VAGUE TIMELINE ─────────────────────────────────────────────────────────
  { match: "i'll do it later",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll do it by 4 PM today — I'll post an update in this thread when it's done." },

  { match: "i'll get to it later",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll get to it by 4 PM today and share the result in this thread." },

  { match: "i'll look at it later",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll look at it by 4 PM today and leave comments directly in the doc." },

  { match: "i'll check later",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll check by 4 PM today and reply in this thread with my findings." },

  { match: "i'll do it soon",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll do it by Thursday EOD — let me know if you need it sooner." },

  { match: "i'll send it soon",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll send it by Thursday EOD — let me know if you need it sooner." },

  { match: "i'll finish soon",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll finish by Thursday EOD and post the final version in this channel." },

  { match: "i'll update it soon",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll update it by Thursday EOD and share the link here." },

  { match: "asap",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll prioritize this and have it done by tomorrow at 10 AM — I'll post a confirmation here." },

  { match: "as soon as possible",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll prioritize this and have it done by tomorrow at 10 AM — I'll post a confirmation here." },

  { match: "when i get a chance",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll get to this by Wednesday noon — I'll post an update in this thread." },

  { match: "when i have time",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll set aside time Thursday morning and have it done by noon — I'll post the result here." },

  { match: "at some point",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll complete this by [specific date] — I'll post a status update here when done." },

  { match: "sometime this week",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll complete this by Thursday EOD — I'll post a status update here when done." },

  { match: "in a bit",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll have this done by 3 PM today and post an update in this thread." },

  { match: "eventually",
    type: 'VAGUE TIMELINE',
    suggestion: "I'll set a concrete deadline — I'll have this done by [specific date] and notify the team here." },

  { match: "whenever",
    type: 'VAGUE TIMELINE',
    suggestion: "Let's set a deadline — I'll have this done by [specific date]. Does that work for the team?" },

  // ── PASSIVE / UNCLEAR NEXT STEP ────────────────────────────────────────────
  { match: "let me know",
    type: 'PASSIVE MESSAGE',
    suggestion: "Please reply in this thread by Wednesday EOD so I can move forward. If I don't hear back, I'll follow up directly." },

  { match: "let me know if",
    type: 'PASSIVE MESSAGE',
    suggestion: "Please reply in this thread by Wednesday EOD. If I don't hear back, I'll assume we're good to proceed." },

  { match: "just ping me",
    type: 'PASSIVE MESSAGE',
    suggestion: "Send me a message in #general by Thursday noon and I'll respond within 2 hours." },

  { match: "feel free to reach out",
    type: 'PASSIVE MESSAGE',
    suggestion: "If you have questions, post them in #general by Wednesday — I'll reply within 24 hours." },

  { match: "keep me posted",
    type: 'PASSIVE MESSAGE',
    suggestion: "Please send me a status update in this thread by Friday at 3 PM so I can plan accordingly." },

  { match: "keep us posted",
    type: 'PASSIVE MESSAGE',
    suggestion: "Please post a status update here by Friday at 3 PM so the whole team can stay aligned." },

  { match: "we should sync",
    type: 'PASSIVE MESSAGE',
    suggestion: "Let's sync — I'm free Tuesday 2–3 PM or Wednesday 10–11 AM. @[name], which works for you? I'll send a calendar invite." },

  { match: "we should touch base",
    type: 'PASSIVE MESSAGE',
    suggestion: "Let's touch base — I'm available Thursday 1–2 PM or Friday morning. @[name], does either work? I'll send the invite." },

  { match: "circle back",
    type: 'PASSIVE MESSAGE',
    suggestion: "Let's circle back on Friday at 10 AM — I'll post a summary of next steps here before the call." },

  { match: "we'll figure it out",
    type: 'PASSIVE MESSAGE',
    suggestion: "Let's figure this out now — @[name], can you propose two options by Wednesday so we can decide before Friday's review?" },

  { match: "we can discuss",
    type: 'PASSIVE MESSAGE',
    suggestion: "Let's discuss this on [specific day/time] — I'll add it as an agenda item and share the meeting notes here afterward." },

  { match: "we'll discuss later",
    type: 'PASSIVE MESSAGE',
    suggestion: "Let's schedule a specific time — I'm free Wednesday 2–3 PM. @[name], does that work? I'll add it to the calendar." },

  { match: "we'll talk about it",
    type: 'PASSIVE MESSAGE',
    suggestion: "Let's set a time — I'll add this to the agenda for our next meeting on [date] and share discussion notes afterward." },

  { match: "we'll sort it out",
    type: 'PASSIVE MESSAGE',
    suggestion: "Let's sort this out now — @[name], can you own the decision and post the outcome here by Thursday?" },

];

// ── Pattern detection engine ─────────────────────────────────────────────────

// True if the message already has a specific deadline, person, or deliverable.
// Clear messages like "I'll send it by Friday at 5 PM" won't get flagged.
function hasSpecifics(t) {
  return /\b(by\s+\w|before\s+\w|no later than|at\s+\d|\d+(:\d\d)?\s*(am|pm)\b|on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)|tomorrow|tonight|this\s+(morning|afternoon|evening|friday|monday|tuesday|wednesday|thursday)|end of (day|week|month)|eod|eow|noon|midnight|next\s+(week|monday|tuesday|wednesday|thursday|friday)|\d+\s*(days?|hours?|mins?|minutes?)\s*(from now)?)\b/i.test(t);
}

const COLLAB_PATTERNS = [

  // ── 1. Vague commitment ───────────────────────────────────────────────────
  // Catches promises/confirmations without a deadline, owner, or deliverable.
  {
    type: 'VAGUE COMMITMENT',
    test: (t) => {
      if (hasSpecifics(t)) return false;
      const l = t.trim().toLowerCase();
      return (
        // "I'll/I will/I'm going to/I am going to" + anything
        /\b(i'?ll|i\s+will|i'?m\s+going\s+to|i\s+am\s+going\s+to)\s+\w/i.test(t) ||
        // "I'm working/looking/handling/dealing" (in progress, no deadline)
        /\bi'?m\s+(working|looking|handling|dealing|taking\s+care|getting\s+(to|on\s+top)|sorting|fixing|drafting|writing|finishing|completing|following\s+up|reaching\s+out|waiting)\b/i.test(t) ||
        // "I can/could/should/might/may" + action verb
        /\bi\s+(can|could|should|might|may)\s+(do|handle|take|send|write|fix|check|review|update|finish|complete|submit|schedule|reach|follow|look|get|sort|deal|run|lead|cover|own|manage|prepare|draft|book|set|help|assist|tackle|address|pick\s+up|work\s+on)\b/i.test(t) ||
        // "I'll take care of / get on top of / look into" anything
        /\b(i'?ll|i\s+will)\s+(take\s+care\s+of|get\s+on\s+top\s+of|get\s+around\s+to|get\s+to\s+(it|that|this)?|follow\s+up\s+on|look\s+into|look\s+at|get\s+back\s+(to\s+you)?\s*(on)?|deal\s+with|work\s+on|pick\s+up|tackle|address|handle|sort\s+(it\s+)?out|figure\s+(it\s+)?out)\b/i.test(t) ||
        // Bare short confirmations (whole message)
        /^(will do|on it|got it|i got (it|this)|leave it to me|sure\.?|sure thing|yep\.?|yup\.?|ok\.?|okay\.?|k\.?|sounds good\.?|no problem\.?|np\.?|noted\.?|consider it done|working on it|looking into it|handling it|on my list|i'?ll do it|i'?ll handle it|i'?ll check|i'?ll follow up|i'?ll get to it|i'?ll get (it\s+)?done|i'?ll sort it( out)?|i'?ll look into it|i'?ll reach out|i'?ll think about it|i'?ll try|trying|trying to|i'll see what i can do)[.!]?$/i.test(l) ||
        // "I'll try to" / "I'll attempt to" — hedged
        /\b(i'?ll|i\s+will)\s+(try(\s+to)?|attempt(\s+to)?|do\s+my\s+best|see\s+what\s+i\s+can\s+do)\b/i.test(t) ||
        // "It'll be done", "it should be ready", "it will be finished" (passive, no owner/deadline)
        /\b(it'?s?\s+(almost|nearly)\s+(done|ready|finished|complete)|it\s+(will|should|'ll)\s+be\s+(done|ready|finished|sent|updated|completed))\b/i.test(t) ||
        // "Almost done", "nearly finished", "making progress" (status with no ETA)
        /^(almost (done|ready|finished|there)|nearly (done|ready|finished)|making progress|in progress|work in progress|wip)[.!]?$/i.test(l)
      );
    },
    suggest: (t) => {
      if (/try|attempt|best|see what/i.test(t))
        return `I'll [specific task] and have it done by [date/time] — I'll post the result in this channel.`;
      if (/working on|in progress|wip|almost|nearly|making progress/i.test(t))
        return `I'll have this done by [date] at [time] and post an update here.`;
      if (/think about|consider/i.test(t))
        return `I'll [do X] by [date] and share my decision in this thread.`;
      if (/review|look at|check/i.test(t))
        return `I'll review this by [date] at [time] and share my feedback in this thread.`;
      if (/send|email|message|reach out|contact/i.test(t))
        return `I'll send [specific thing] to [person] by [date] at [time] and CC the team here.`;
      if (/fix|resolve|debug|patch/i.test(t))
        return `I'll fix this by [date] at [time] — I'll push the update and post a confirmation in this channel.`;
      if (/update|edit|revise|change/i.test(t))
        return `I'll update [specific doc/thing] by [date] and share the link in this channel when done.`;
      if (/write|draft|prepare|create/i.test(t))
        return `I'll draft [specific deliverable] and post it in this channel by [date] at [time].`;
      if (/schedule|book|set up|organise|organize/i.test(t))
        return `I'll schedule [specific meeting/event] for [date/time] and send calendar invites to [names].`;
      if (/follow up|circle back|get back/i.test(t))
        return `I'll follow up with [person] by [specific date/time] and share their response here.`;
      if (/handle|take care|manage|own|lead|cover/i.test(t))
        return `I'll handle [specific task] — I'll have it done by [date] and post the result in this channel.`;
      if (/finish|complete|submit/i.test(t))
        return `I'll finish [specific deliverable] and submit it to [person] by [date] at [time].`;
      return `I'll [specific task] by [date/time] and share the result in [channel].`;
    },
  },

  // ── 2. Vague referral ────────────────────────────────────────────────────
  // "Ask Steve", "talk to them", "check with marketing", "ping her"
  {
    type: 'VAGUE REFERRAL',
    test: (t) => /\b(ask|talk\s+to|check\s+with|reach\s+out\s+to|contact|ping|message|dm|loop\s+in|cc|speak\s+to|speak\s+with|get\s+in\s+touch\s+with)\s+(steve|lesley|alex|him|her|them|the\s+(team|dev|design|marketing|engineering|product|finance|legal|hr|sales)\s*(team|dept|department)?|management|the\s+manager|someone|anyone|that\s+(person|guy|girl|team))\b/i.test(t),
    suggest: (t) => {
      const m    = t.match(/\b(ask|talk to|check with|reach out to|contact|ping|message|dm|loop in|speak to|get in touch with)\s+(\w+)/i);
      const name = m ? m[2] : '[name]';
      const cap  = name.charAt(0).toUpperCase() + name.slice(1);
      if (/steve/i.test(name))  return `Tag @Steve (VP of Marketing) directly in this channel — "Hey @Steve, can you [specific question] by [date]?" — so everyone sees the answer.`;
      if (/lesley/i.test(name)) return `Tag @Lesley (Project Lead) directly here — "Hey @Lesley, can you clarify [specific thing] by [date]?" — so the whole team stays informed.`;
      if (/alex/i.test(name))   return `Tag @Alex (Design Lead) in #design — "Hey @Alex, can you [specific ask] by [date]?" — with exactly what you need and when.`;
      if (/manager|management/i.test(t)) return `Tag the specific manager by name — "@[Manager's name], can you [specific ask] by [date]?" — so there's clear accountability.`;
      return `Tag @${cap} directly here with a specific ask — "Hey @${cap}, can you [specific task] by [date]?" — so everyone sees the answer and it doesn't fall through the cracks.`;
    },
  },

  // ── 3. Unclear ownership ────────────────────────────────────────────────
  // "someone should", "the team needs to", "who's handling this?", "this needs doing"
  {
    type: 'UNCLEAR OWNERSHIP',
    test: (t) => /\b(someone\s+(should|can|needs?\s+to|has\s+to|will|must|ought\s+to|please)|anyone\s+(can|want\s+to|wants?\s+to|should|will|able\s+to|free\s+to)|whoever\s+(can|wants?|is\s+free|has\s+time)|who('?s|\s+is)\s+(going\s+to|handling|doing|taking\s+care\s+of|responsible|in\s+charge|owning)|does\s+anyone|can\s+anyone|the\s+team\s+(should|needs?\s+to|has\s+to|will|must)|we\s+(all\s+)?(need\s+to|should|have\s+to|must)\s+\w|this\s+(needs?\s+to|should|has\s+to|must)\s+be\s+(done|handled|updated|reviewed|sent|fixed|completed|sorted|addressed)|needs?\s+(to\s+be\s+(done|handled|fixed|updated|reviewed|completed)|attention|someone))\b/i.test(t),
    suggest: (t) => {
      if (/present|demo|show/i.test(t))   return `@[name], could you own the presentation? Please confirm by [date] so we can add it to the agenda.`;
      if (/deploy|release|push/i.test(t)) return `@[name], can you run the deployment? Please confirm availability by [time] today.`;
      if (/review|check|look at/i.test(t)) return `@[name], can you own this review? Please complete it by [date] and share your feedback in this thread.`;
      if (/update|edit|fix|patch/i.test(t)) return `@[name], can you take this? Please have it done by [date] and post the link here.`;
      if (/the team|we (need|should|have to)/i.test(t)) return `Let's assign this clearly — @[name], can you own [specific task] by [date]? Please confirm here.`;
      return `Let's assign this now — @[name], can you take ownership of [specific task] and have it done by [date]? Please confirm here so we can track it.`;
    },
  },

  // ── 4. Vague timeline ───────────────────────────────────────────────────
  // "later", "soon", "asap", "whenever", "in a few days", "next week" (without a day)
  {
    type: 'VAGUE TIMELINE',
    test: (t) => /\b(later|soon|sometime|eventually|in\s+a\s+bit|in\s+a\s+few\s+(days?|hours?)|at\s+some\s+point|when\s+(i\s+get|i\s+have|we\s+have|there('?s|\s+is))\s+(a\s+chance|time|bandwidth|capacity|a\s+moment)|asap|a\.s\.a\.p\.?|as\s+soon\s+as\s+possible|whenever|sometime\s+this\s+(week|month)|in\s+a\s+while|not\s+sure\s+when|when\s+i\s+can|if\s+i\s+get\s+a\s+chance|end\s+of\s+(the\s+)?day|next\s+week|this\s+week|in\s+the\s+(near|coming)\s+future|shortly|at\s+my\s+earliest|when\s+possible|as\s+needed|on\s+an\s+as\-needed\s+basis|when\s+we\s+get\s+(there|to\s+it))\b/i.test(t),
    suggest: (t) => {
      if (/asap|a\.s\.a\.p|as soon as possible/i.test(t))
        return `${t.replace(/asap|a\.s\.a\.p\.?|as soon as possible/gi, 'by tomorrow at 10 AM')} — I'll post a confirmation here when it's done.`;
      if (/\blater\b/i.test(t))
        return `${t.replace(/\blater\b/i, 'by 4 PM today')} — I'll post an update in this thread.`;
      if (/\bsoon\b|\bshortly\b/i.test(t))
        return `${t.replace(/\bsoon\b|\bshortly\b/i, 'by Thursday EOD')} — let me know if you need it sooner.`;
      if (/next week/i.test(t))
        return `${t.replace(/next week/i, 'by Monday at noon')} — I'll post a status update here when it's done.`;
      if (/this week/i.test(t))
        return `${t.replace(/this week/i, 'by Friday at 3 PM')} — I'll confirm in this thread.`;
      if (/in a few days/i.test(t))
        return `${t.replace(/in a few days/i, 'by Wednesday at noon')} — I'll post a confirmation here.`;
      return `I'll have this done by [day] at [time] and post a confirmation here.`;
    },
  },

  // ── 5. Passive / no clear next step ─────────────────────────────────────
  // "let me know", "lmk", "thoughts?", "ping me", "we should sync", "fyi", "heads up"
  {
    type: 'PASSIVE MESSAGE',
    test: (t) => /\b(let\s+me\s+know(\s+if|\s+when|\s+what|\s+your\s+thoughts)?|lmk|just\s+(ping|dm|message|slack)\s+me|feel\s+free\s+to\s+(reach\s+out|message|contact|dm|slack)|keep\s+(me|us)\s+(posted|updated|in\s+the\s+loop)|we\s+('?ll|will|should|need\s+to)\s+(sync|touch\s+base|talk|chat|catch\s+up|discuss|circle\s+back|connect|meet|regroup)|circle\s+back|touch\s+base|we'?ll\s+(figure|sort)\s+it\s+out|we\s+can\s+(discuss|talk\s+about|go\s+over)\s+(this|it|that)\s+later|holler\s+if|shout\s+if|reach\s+out\s+if|open\s+to\s+(suggestions|feedback|ideas)|any\s+(thoughts|feedback|opinions|ideas|input|questions)\??|thoughts\??|feedback\s+(welcome|appreciated|needed)|just\s+(fyi|a\s+heads?\s+up)|for\s+(your|everyone'?s?)\s+(awareness|info|information|reference|fyi)|ping\s+me\s+if|let\s+me\s+know\s+what\s+you\s+think)\b/i.test(t),
    suggest: (t) => {
      if (/let me know|lmk/i.test(t))
        return `${t.replace(/let me know(\s+(if|when|what|your thoughts))?|lmk/gi, 'please reply in this thread by [date]')} — I'll follow up directly if I don't hear back.`;
      if (/thoughts\??|any\s+(feedback|opinions|ideas|input)/i.test(t))
        return `@[name], can you give feedback on [specific thing] by [date]? I need a response before [deadline].`;
      if (/fyi|heads up|for your awareness|for your info/i.test(t))
        return `@[name], please review this by [date] and confirm in this thread.`;
      if (/open to (suggestions|feedback|ideas)/i.test(t))
        return `@[name], can you share your [feedback/suggestions] on [specific thing] by [date]? I need to decide by [deadline].`;
      if (/sync|touch base|catch up|connect|meet|regroup/i.test(t))
        return `Let's schedule a specific time — I'm free [day] at [time]. @[name], does that work? I'll send a calendar invite.`;
      if (/circle back/i.test(t))
        return `Let's circle back on [specific date] at [time] — I'll post a summary of next steps here before then.`;
      if (/figure it out|sort it out/i.test(t))
        return `Let's decide now — @[name], can you propose two options by [date] so we can pick one before [deadline]?`;
      if (/keep (me|us) (posted|updated|in the loop)/i.test(t))
        return `Please post a status update in this thread by [date] at [time] so the team can stay aligned.`;
      if (/ping me|reach out|holler|shout/i.test(t))
        return `Please reply in this thread by [date] with [what you need] — I'll respond within [time].`;
      return `@[name], please [specific action] by [date] and post the result here.`;
    },
  },
];

// ── State ────────────────────────────────────────────────────────────────────
let currentChannel = 'general';
let pendingSuggestion = null;   // { original, suggestion, type }
let _bypassCheck = false;       // true after dismiss — lets the next send go through

// ── DOM refs ─────────────────────────────────────────────────────────────────
const messagesArea    = document.getElementById('messages-area');
const composerInput   = document.getElementById('composer-input');
const btnSend         = document.getElementById('btn-send');
const petNotification = document.getElementById('pet-notification');
const notifOriginal   = document.getElementById('notif-original');
const notifSuggestion = document.getElementById('notif-suggestion');
const notifTypeBadge  = document.getElementById('notif-type-badge');
const btnUseSuggestion= document.getElementById('btn-use-suggestion');
const btnDismissNotif = document.getElementById('btn-dismiss-notif');
const petBubble       = document.getElementById('pet-bubble');
const petLabel        = document.getElementById('pet-label');
const channelHeaderName  = document.getElementById('channel-header-name');
const channelHeaderTopic = document.getElementById('channel-header-topic');

// ── Pet init ─────────────────────────────────────────────────────────────────
let _petAnimFrame = null;

function initPet() {
  const canvas = document.getElementById('slack-pet-canvas');
  const idx    = Math.max(0, Math.min(PET_INDEX, PET_SPRITES.length - 1));
  petLabel.textContent = PET_NAME.toUpperCase();

  let frame = 0;
  function loop() {
    renderPetAnimated(canvas, idx, 3, frame++);
    _petAnimFrame = requestAnimationFrame(loop);
  }
  loop();
}

// ── Render messages ──────────────────────────────────────────────────────────
function renderMessages(channelId) {
  const ch   = CHANNELS[channelId];
  const msgs = ch.messages;
  messagesArea.innerHTML = '';

  // Group by date (they're all "Today" in our sim)
  const divider = document.createElement('div');
  divider.className = 'day-divider';
  divider.innerHTML = `<div class="day-divider-line"></div>
    <div class="day-divider-text">TODAY</div>
    <div class="day-divider-line"></div>`;
  messagesArea.appendChild(divider);

  msgs.forEach(msg => {
    messagesArea.appendChild(buildMessageEl(msg));
  });

  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function buildMessageEl(msg) {
  const isYou   = msg.user === 'You';
  const flagged = msg._flagged || false;

  const group = document.createElement('div');
  group.className = 'message-group' + (isYou ? ' is-you' : '');

  group.innerHTML = `
    <div class="message-avatar" style="color:${msg.color}">${msg.avatar}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-user" style="color:${msg.color}">${msg.user}</span>
        <span class="message-time">${msg.time}</span>
      </div>
      <div class="message-text${flagged ? ' flagged' : ''}">
        ${escapeHtml(msg.text)}${flagged ? ' <span class="flag-badge">IMPROVED</span>' : ''}
      </div>
    </div>`;
  return group;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Analyze text for collaboration patterns ──────────────────────────────────
function analyzeText(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const pattern of COLLAB_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        type:       pattern.type,
        original:   trimmed,
        suggestion: pattern.suggest(trimmed),
      };
    }
  }

  return null;
}

// ── Show / hide notification ─────────────────────────────────────────────────
function showNotification(data) {
  pendingSuggestion = data;
  notifTypeBadge.textContent  = data.type;
  notifOriginal.textContent   = data.original;
  notifSuggestion.textContent = data.suggestion;
  petNotification.classList.remove('hidden');

  // Gentle bounce on pet bubble
  petBubble.style.transform = 'translateY(-4px)';
  setTimeout(() => { petBubble.style.transform = ''; }, 400);
}

function hideNotification() {
  petNotification.classList.add('hidden');
  pendingSuggestion = null;
}

// ── Typing indicator ─────────────────────────────────────────────────────────
function showTyping(teammate) {
  const id = 'typing-' + teammate.replace(/\s/g, '');
  if (document.getElementById(id)) return;
  const t = TEAMMATES[teammate] || { avatar: teammate[0], color: '#8060AA' };
  const el = document.createElement('div');
  el.id = id;
  el.className = 'message-group typing-indicator';
  el.innerHTML = `
    <div class="message-avatar" style="color:${t.color}">${t.avatar}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-user" style="color:${t.color}">${teammate}</span>
      </div>
      <div class="message-text typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  messagesArea.appendChild(el);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function hideTyping(teammate) {
  const el = document.getElementById('typing-' + teammate.replace(/\s/g, ''));
  if (el) el.remove();
}

// ── Auto-replies ──────────────────────────────────────────────────────────────
let _replyTimers = [];

function cancelReplies() {
  _replyTimers.forEach(clearTimeout);
  _replyTimers = [];
  // Clear any leftover typing indicators
  messagesArea.querySelectorAll('.typing-indicator').forEach(el => el.remove());
}

function scheduleReplies(channelId) {
  const ch = CHANNELS[channelId];
  if (!ch.replies || !ch.replies.length) return;

  // Rotate through replies so repeat sends give fresh responses
  const pool = ch._replyPool ?? (ch._replyPool = [...ch.replies]);
  if (pool.length === 0) return;
  const reply = pool.shift();   // take next reply from pool

  // Show typing dots ~1s before the reply arrives
  const typingDelay = Math.max(0, reply.delay - 1000);
  _replyTimers.push(setTimeout(() => showTyping(reply.user), typingDelay));

  _replyTimers.push(setTimeout(() => {
    hideTyping(reply.user);
    // Only post if still in the same channel
    if (currentChannel !== channelId) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const msg = { user: reply.user, avatar: reply.avatar, color: reply.color, time: timeStr, text: reply.text };
    CHANNELS[channelId].messages.push(msg);
    messagesArea.appendChild(buildMessageEl(msg));
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }, reply.delay));
}

// ── Send message ─────────────────────────────────────────────────────────────
function sendMessage() {
  const text = composerInput.value.trim();
  if (!text) return;

  // Check for collaboration pattern — block send and show suggestion
  // (bypass once if user already dismissed the suggestion for this message)
  if (!_bypassCheck) {
    const hit = analyzeText(text);
    if (hit) {
      showNotification(hit);
      composerInput.focus();
      return;
    }
  }
  _bypassCheck = false;

  // All clear — send the message
  composerInput.value = '';

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const msg = { user: 'You', avatar: '▸', color: '#C060FF', time: timeStr, text };
  CHANNELS[currentChannel].messages.push(msg);

  const el = buildMessageEl(msg);
  messagesArea.appendChild(el);
  messagesArea.scrollTop = messagesArea.scrollHeight;

  // Trigger teammate replies
  cancelReplies();
  scheduleReplies(currentChannel);

  composerInput.focus();
}

// ── Use suggestion: load into composer for editing ───────────────────────────
function useSuggestion() {
  if (!pendingSuggestion) return;

  composerInput.value = pendingSuggestion.suggestion;
  hideNotification();
  composerInput.focus();
  // Place cursor at end
  composerInput.setSelectionRange(composerInput.value.length, composerInput.value.length);
}

// ── Switch channel ────────────────────────────────────────────────────────────
function switchChannel(channelId) {
  if (!CHANNELS[channelId]) return;
  currentChannel = channelId;

  // Update sidebar active state
  document.querySelectorAll('.channel-item').forEach(el => {
    el.classList.toggle('active', el.dataset.channel === channelId);
    // Remove unread dot when visited
    if (el.dataset.channel === channelId) {
      const dot = el.querySelector('.unread');
      if (dot) dot.remove();
    }
  });

  const ch = CHANNELS[channelId];
  const isDM = channelId.startsWith('dm-');
  channelHeaderName.textContent  = isDM ? ch.name : ch.name;
  channelHeaderTopic.textContent = ch.topic;

  // Update composer placeholder
  composerInput.placeholder = isDM ? `Message ${ch.name}` : `Message ${ch.name}`;

  cancelReplies();
  hideNotification();
  renderMessages(channelId);
}

// ── Event listeners ───────────────────────────────────────────────────────────
btnSend.addEventListener('click', sendMessage);
composerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
// Reset bypass if user edits their message after dismissing
composerInput.addEventListener('input', () => { _bypassCheck = false; });

btnUseSuggestion.addEventListener('click', useSuggestion);
btnDismissNotif.addEventListener('click', () => {
  // Allow the next send to go through without re-flagging
  _bypassCheck = true;
  hideNotification();
  composerInput.focus();
});

petBubble.addEventListener('click', () => {
  if (petNotification.classList.contains('hidden')) {
    // Show a friendly idle message if no active suggestion
    if (!pendingSuggestion) {
      petNotification.classList.remove('hidden');
      notifTypeBadge.textContent  = 'HELLO!';
      notifOriginal.textContent   = '(no messages flagged yet)';
      notifSuggestion.textContent = `Hi! I'm ${PET_NAME}. I'll flag vague messages and suggest clearer alternatives. Try sending a message like "I'll handle it" or "Ask Steve."`;
      document.getElementById('btn-use-suggestion').style.display = 'none';
      setTimeout(() => {
        hideNotification();
        document.getElementById('btn-use-suggestion').style.display = '';
      }, 4000);
    }
  } else {
    hideNotification();
  }
});

document.querySelectorAll('.channel-item').forEach(el => {
  el.addEventListener('click', () => switchChannel(el.dataset.channel));
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initPet();
renderMessages('general');
