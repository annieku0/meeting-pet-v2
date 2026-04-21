// AI-powered meeting transcript analyzer using Claude API
// Called from background.js service worker

async function analyzeTranscript(transcript, apiKey) {
  const systemPrompt = `You are analyzing a meeting transcript snippet to identify communication moments that help cross-department collaboration.

For each identified moment, assign one of these treat types:

- apple: Clarifying question — someone asked what a term or scope means, often phrased as "when you say X, do you mean Y or Z?"
  Examples: "When you say 'MVP,' do you mean strictly the three core features, or does it include the onboarding flow too?"
            "And when we say 'code freeze,' does that mean no new features, or does it include bug fixes too?"
            "What exactly qualifies as a 'P1' ticket? I've seen that term used differently."
            "When the slides say we're 'on track,' does that mean hitting all KPIs or just the revenue target?"
            "When we say 'data retention,' are we talking about how long we store user data, or how long we keep logs?"
            "What counts as a 'closed deal' for finance reporting purposes? Is it signed contract or payment received?"
            "When we say 'unlimited PTO,' does that mean employees don't need manager approval, or just that there's no accrual cap?"
            "What counts as a 'final design' for handoff? Does it need all states, or just the happy path?"
            "When we say 'zero downtime deployment,' does that mean users experience no interruption, or that the servers never fully restart?"
            "What do we mean by 'launch day'? Is that when the product goes live technically, or when we start external communications?"

- cake: Deadline / timeline question — someone asked about timing, due dates, or when something goes into effect
  Examples: "What's the deadline for the MVP code freeze?"
            "When does the new retention policy go into effect?"
            "What's the cutoff for submitting creative assets to the design team?"
            "When does this sprint officially end?"
            "What's our target date for rolling out the new escalation dashboard?"
            "How long do we have to respond to a P1 before it auto-escalates?"
            "When's the cutoff for Q4 deal submissions to count in this fiscal year?"
            "When are we presenting our Q4 targets to the board?"
            "What's the deadline for migrating to the new Kubernetes cluster?"
            "When does the new policy go into effect?"

- cookie: Process / workflow question — someone asked how something works, who owns a step, or what the sequence is
  Examples: "Can someone walk me through how the release approval process works? Who signs off before we push to production?"
            "What's the process once a P1 escalates? Who gets looped in?"
            "How does the asset review process work? Does it go through legal first or marketing?"
            "How do we handle tickets that are in progress but not done by end of sprint?"
            "What's the process for flagging a non-compliant system?"
            "What's the process for deals with custom payment schedules? Do those go through a different approval path?"
            "What's the process for collecting acknowledgements — digital or wet signatures?"
            "How does the feedback process work? Does engineering give feedback directly in Figma, or do they submit tickets?"
            "What's the process for getting a new service approved to run in production? Is there a security review gate?"
            "Does it run in parallel with staging or sequentially?"

- carrot: Jargon translated — someone defined a term, resolved a naming conflict between teams, or aligned the group on shared vocabulary
  Examples: "On the engineering side, 'soft launch' means 10% traffic rollout. For marketing it means 'announcement day.' Let me translate: for this call, soft launch = limited rollout."
            "Sandbox is for developer testing, pre-prod is the final staging environment before release — two different things."
            "We've been saying 'SLA' to customers but our internal docs call it 'response commitment.' I'll standardize to 'SLA' going forward."
            "Engineering calls the deletion process 'purge,' but legal refers to it as 'right to erasure.' We should standardize on 'right to erasure' in all external docs."
            "We use 'velocity' to mean two different things. Let's agree: velocity = story points per sprint."
            "Sales uses 'closed-won' but finance books it as 'recognized revenue' — not always the same timing."
            "Engineering calls it the 'launch hub' in tickets and marketing calls it the 'campaign page.' Let's align — we'll call it the 'launch hub' going forward."
            "For our purposes today, MVP means the three core features only."
            "'Hardening' in this context means security hardening only — not performance tuning."
            "ARR must mean annualized recurring revenue only in all external communications — not annual run rate."

- star: Action item defined — someone committed to a specific next step, named an owner, or set a deadline
  Examples: "I'll take an action item: I'll update the Confluence page with those dates today."
            "Action item: Yuki, can you update the agent handbook with the P1/P2 definitions and the four-hour threshold?"
            "Action item: Chris will update the marketing brief template to use 'launch hub' everywhere."
            "Action item for Naomi: update the design glossary by end of week."
            "I'll take an action item to compile a list of all deals with custom payment schedules before December 28th."
            "I'll take an action item to put together the Kubernetes migration checklist and share it with the team by next Friday."
            "I'll take an action item to brief the finance team on the ARR definition change before they run Q4 numbers."
            "I'll groom the backlog and tag anything that's ready for dev before our next standup."
            "Victor will draft a communication to all managers explaining the new PTO approval process before December 15th."
            "I'll send the asset checklist to all teams by end of day Friday."

- candy: Cross-team alignment — two or more named departments explicitly confirmed they agree or share the same understanding
  Examples: "Engineering and product are aligned — October 15th for features, October 18th for critical fixes."
            "Sales and finance are aligned on the December 28th cutoff — no exceptions."
            "Legal and engineering both confirmed January 1st is a hard deadline with no extensions."
            "Security and infrastructure are both aligned on the March 31st migration deadline."
            "HR and legal are aligned that January 1st is a hard go-live date."
            "Product and design are both aligned that eliminating the two-step modal is the correct solution."
            "Both teams are clear on the October 30th/31st split — engineering go-live then marketing launch."
            "Finance and executive leadership are aligned on this change. No ambiguity going forward."
            "QA and engineering aligned that CI flaky test disablement is a temporary measure, not a permanent fix."
            "Both teams aligned on this?"

- blueberry: Follow-up scheduled — the group agreed to a specific future meeting, review, or check-in
  Examples: "Let's schedule a pre-release review on October 13th. I'll send the calendar invite."
            "Let's do a follow-up on November 1st readiness — I'll schedule a check-in for October 28th."
            "Let's schedule a final pre-launch sync for October 29th to confirm everything is green. I'll send the invite."
            "Let's schedule a check-in mid-December to review audit results."
            "Let's schedule a short retro next Wednesday to review the CI situation."
            "Let's set up a quick check-in on December 20th to make sure everything is on track."
            "Let's schedule a migration progress review for February 28th. I'll send the invite."
            "Let's schedule a check-in on December 20th to review acknowledgement completion rates."
            "Let's do a follow-up review on September 10th to make sure all states are covered."
            "Let's schedule a pre-board prep session on November 4th to review the final slides."

- gem: Problem solved in-meeting — a blocker, bug, or issue was actively identified and fixed during the meeting itself
  Examples: "Yuki identified and fixed the permissions error blocking the dashboard build — live in the meeting."
            "I traced the CI pipeline failures to a flaky test in the auth module. I've disabled it for now. Pipeline is stable again."
            "I've been trying to figure out why staging was dropping connections. I just realized it's a misconfigured timeout in the load balancer. I've corrected it. Staging is stable now."
            "Naomi redesigned the confusing two-step modal as a single inline confirmation during the meeting — resolving the core usability issue."
            "We just resolved the CDN routing issue right now — we were blocked on this for a week."
            "I just pulled up the blocking ticket — it was a permissions error. I can fix that right now. Done."
            "I traced it to a flaky test in the auth module. Pipeline is stable again."
            "I've corrected the misconfigured timeout. Staging is stable now."
            "We found the root cause and fixed it live."
            "That resolves the core blocker we've been stuck on."

IMPORTANT RULES:
- Award one entry per distinct moment — not per sentence, not per speaker turn.
- The same treat type CAN appear multiple times if there are multiple distinct moments of that type. For example, two separate deadline questions = two cake entries.
- Do NOT merge distinct moments into one entry.
- Do NOT award a treat for the same moment twice.
- Be conservative — only award treats for clear, genuine instances.

Return ONLY a JSON object like:
{
  "treats": ["apple", "cake", "cake", "star", "star"],
  "count": 5,
  "moments": [
    {"treat": "apple", "quote": "brief quote or description of moment"},
    {"treat": "cake", "quote": "brief quote or description of first cake moment"},
    {"treat": "cake", "quote": "brief quote or description of second cake moment"},
    {"treat": "star", "quote": "brief quote or description of first star moment"},
    {"treat": "star", "quote": "brief quote or description of second star moment"}
  ]
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this meeting transcript snippet:\n\n${transcript}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text || '{}';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid response format');

  return JSON.parse(jsonMatch[0]);
}

// Fallback keyword-based analysis (when no API key)
function analyzeTranscriptLocal(transcript) {
  const lower = transcript.toLowerCase();
  const foundTreats = [];
  const moments = [];

  const patterns = [
    {
      treat: 'apple',
      keywords: [
        'just to clarify', 'can you clarify', 'what do you mean', 'when you say',
        'do you mean', 'what success looks like', 'are we talking about',
        'is this meant to', 'just to make sure i understand', 'are we prioritizing',
        'does this apply to', 'what exactly are we', 'are we measuring',
        'is this part of', 'should this integrate', 'are we designing for',
        'do we have data to support', 'are there any constraints',
        'is this aligned', 'who is the primary stakeholder', 'can you explain',
        "i don't understand", 'short-term issue or long-term',
      ],
    },
    {
      treat: 'cake',
      keywords: [
        'when do we need this', 'hard deadline', 'how much time do we have before launch',
        'fixed release date', 'extend the timeline', 'next milestone',
        'ready before the stakeholder review', 'testing phase expected to take',
        'when should we start', 'tied to a quarterly goal', 'buffer time for revisions',
        'design need to be finalized', 'deadline for feedback', 'need approvals',
        'final handoff to engineering', 'time for user testing', 'timeline realistic',
        'dependencies affecting timing', 'earliest we can launch', 'how strict is this deadline',
        'deadline', 'by when', 'when is this due', 'timeline', 'schedule', 'eta',
      ],
    },
    {
      treat: 'cookie',
      keywords: [
        'next step after this meeting', 'approval process work', 'reviews this before',
        'typical workflow', 'sign-off from multiple teams', 'how do we handle revisions',
        'communicate updates across teams', 'standard template',
        'after development is complete', 'qa process', 'issues reported and tracked',
        'responsible for final approval', 'escalation process', 'how do we prioritize',
        'document decisions', 'how often do we sync', 'process for user feedback',
        'handle last-minute changes', 'checklist before launch',
        "what's the process", 'who owns', 'who is responsible', 'how do we', 'workflow',
      ],
    },
    {
      treat: 'carrot',
      keywords: [
        'when engineering says', 'when marketing says', 'they mean how quickly',
        'here means users', 'mvp just means', "by 'scalable'", "'back-end' refers",
        "'front-end' is", "'api' is how", "'sprint' is", "'bug' just means",
        "'retention' means", "'churn' means", "'a/b testing' is", "'onboarding' is",
        "'bandwidth' means", "'deployment' is", "'ux' stands', \"'ui' refers",
        'they basically mean', "they're talking about", 'just means the simplest',
        'in other words', 'what we mean by', 'terminology', 'in our team we call',
      ],
    },
    {
      treat: 'star',
      keywords: [
        "i'll update the presentation", 'take ownership of', "let's have design",
        "i'll follow up with stakeholders", 'will handle the technical',
        'will revise the user flow', "we'll gather user feedback",
        "i'll document today", "let's assign someone", "we'll prepare a demo",
        "i'll coordinate with marketing", "let's finalize requirements",
        "i'll set up a shared document", "we'll review analytics",
        "i'll reach out to the client", "let's divide tasks",
        "i'll handle the scheduling", "we'll draft a proposal",
        "i'll ensure alignment", "let's create a timeline",
        "i'll take ownership", 'action item', 'will follow up',
        'next steps', 'assigned to', 'by thursday', 'by friday', 'by monday', 'by tomorrow',
        'can you take ownership', 'report back',
      ],
    },
    {
      treat: 'candy',
      keywords: [
        'aligns with what we heard', 'marketing is seeing the same',
        'matches feedback from customer support', "we're all pointing toward",
        'works for both design and engineering', "looks like we're on the same page",
        'supports our overall strategy', 'everyone seems aligned',
        'solution works across teams', "we're converging on the same",
        'fits with our roadmap', 'connects both perspectives',
        'resolves the earlier disagreement', "we've reached a shared understanding",
        'bridges the gap between teams', "we're aligned on next steps",
        "we've synced on the direction", 'balances both needs',
        'same page', 'that aligns', 'we can work with that', 'agreed', 'common ground',
      ],
    },
    {
      treat: 'blueberry',
      keywords: [
        "let's meet again", "i'll send a follow-up meeting invite",
        'check in early next week', "let's regroup after",
        "we'll schedule a sync", "i'll set up a recurring meeting",
        "let's reconnect once", "we'll review this in the next sprint",
        "i'll follow up with you next week", "let's plan a quick check-in",
        "we'll meet again after", "i'll coordinate a follow-up session",
        "let's revisit this", "we'll schedule time to finalize",
        "i'll send a calendar invite", "let's sync after",
        "we'll regroup once", "i'll organize a follow-up",
        "let's meet to review", "we'll connect again after",
        'follow up', 'circle back', 'calendar invite', 'check-in',
      ],
    },
    {
      treat: 'gem',
      keywords: [
        'reuse the existing system instead of building',
        'remove that step, the process becomes simpler',
        'we just solved the main blocker', 'this workaround should fix',
        'automate that instead of doing it manually',
        'eliminates the need for extra resources',
        'we found a simpler solution', 'resolves the performance issue',
        'we can merge these two features', 'fixes the user experience problem',
        'this approach avoids duplication', 'leverage existing data',
        'removes the dependency', 'we found the root cause',
        'simplifies the workflow', 'we can standardize this process',
        'addresses the main concern', "we've identified the solution",
        'clears the bottleneck', 'that solves it', 'problem solved',
        'just solved', 'main blocker', 'simpler solution', 'found the root cause',
      ],
    },
  ];

  for (const { treat, keywords } of patterns) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        if (!foundTreats.includes(treat)) {
          foundTreats.push(treat);
          const idx = lower.indexOf(kw);
          const start = Math.max(0, transcript.lastIndexOf('.', idx) + 1);
          const end = transcript.indexOf('.', idx + kw.length);
          const quote = transcript.slice(start, end > -1 ? end + 1 : start + 120).trim();
          moments.push({ treat, quote: quote || `Detected: "${kw}"` });
        }
        break;
      }
    }
  }

  return { treats: foundTreats, count: foundTreats.length, moments };
}
