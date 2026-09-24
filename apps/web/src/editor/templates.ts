export interface StarterTemplate {
  id: string;
  name: string;
  blurb: string;
  content: string;
}

// Scaffolds are written as real sentences rather than bracketed slots: Glossly
// only has something to suggest against once there is prose to select, so an
// overwritable first draft beats an empty outline.
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'blank',
    name: 'Blank page',
    blurb: 'Nothing but a cursor.',
    content: '<p></p>'
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn post',
    blurb: 'Hook, story, takeaway, ask.',
    content: `
      <p>I spent three years doing this the hard way. Here is what I would tell myself on day one.</p>
      <p>The short version: the thing everyone treats as the hard part is not the hard part.</p>
      <p>Some context. When I started, I assumed the bottleneck was effort. It was not. It was that nobody had written down what "done" looked like, so every round of work restarted the argument.</p>
      <p>Three things changed once we fixed that:</p>
      <ul>
        <li>Decisions took hours instead of weeks, because the criteria were on the page.</li>
        <li>Feedback got specific — people argued with the standard, not with each other.</li>
        <li>The work got smaller, which made it finishable.</li>
      </ul>
      <p>None of this is clever. It is just written down, which turns out to be the rare part.</p>
      <p>If you are in the middle of this right now: write the definition of done first. Everything after it gets cheaper.</p>
      <p>What is the one thing you wish someone had written down for you?</p>
      <p>#writing #craft #lessons</p>
    `
  },
  {
    id: 'blog-article',
    name: 'Blog article',
    blurb: 'Headline, intro, sections, close.',
    content: `
      <h1>A working title that promises one specific thing</h1>
      <p><em>A one-line standfirst: who this is for, and what they will be able to do after reading it.</em></p>
      <p>Open with the problem as the reader experiences it, not as you would define it. The first paragraph earns the second — it should describe a situation they recognise well enough to keep going.</p>
      <p>Then say plainly what this piece argues, so nobody has to guess where it is heading.</p>
      <h2>The context worth having</h2>
      <p>Explain the background that makes the rest make sense. Cut anything the argument does not lean on later.</p>
      <h2>The main idea</h2>
      <p>State the claim in a single sentence, then spend the section defending it. Concrete examples do more work here than adjectives.</p>
      <blockquote>
        <p>A quote, a statistic, or a line from the field that makes the abstract idea land.</p>
      </blockquote>
      <h2>What it looks like in practice</h2>
      <p>Walk through a real case, in order, with the details that would let someone repeat it.</p>
      <ol>
        <li>The first step, and what it costs.</li>
        <li>The second step, and where it usually goes wrong.</li>
        <li>The third step, and how you know it worked.</li>
      </ol>
      <h2>The objection you should take seriously</h2>
      <p>Name the strongest argument against the piece and answer it honestly. A weak straw man reads as a weak argument.</p>
      <h2>Where this leaves you</h2>
      <p>Close on the reader, not on yourself: the one change worth making after reading, and the smallest version of it they could try this week.</p>
    `
  },
  {
    id: 'newsletter',
    name: 'Newsletter issue',
    blurb: 'Intro, one big thing, links, sign-off.',
    content: `
      <h1>Issue №1 — a subject line that reads like a sentence</h1>
      <p>Hello again,</p>
      <p>A short paragraph on what has been on your mind this week, and why it is what you are writing about.</p>
      <h2>The one big thing</h2>
      <p>Give the week a single centre of gravity. Say what happened, why it matters to this particular list, and what you think about it — the opinion is the reason they subscribed.</p>
      <h2>Worth your time</h2>
      <ul>
        <li><strong>A link</strong> — one line on why it is here, not a summary of what it says.</li>
        <li><strong>Another link</strong> — the sentence that made you keep it open in a tab.</li>
        <li><strong>A third link</strong> — something outside the usual beat, for texture.</li>
      </ul>
      <h2>One small thing</h2>
      <p>A tip, a tool, or a line worth stealing. Keep it to a paragraph.</p>
      <p>That is everything for this week. Reply and tell me what you disagreed with — I read all of them.</p>
      <p>Until next time,<br>Your name</p>
    `
  },
  {
    id: 'cover-letter',
    name: 'Cover letter',
    blurb: 'Why you, why them, why now.',
    content: `
      <p>Dear hiring team,</p>
      <p>I am writing about the [role] position. I have spent the last [n] years doing [the specific work], and your description of [the concrete problem in the posting] is the part of the job I would take even if the rest were dull.</p>
      <p>The most relevant thing I have done is [project or responsibility]. I [action you took], which [result, in the units the reader cares about]. The part I would carry over here is [the transferable judgement, not the tool].</p>
      <p>What draws me to [company] specifically is [something true and particular — a product decision, a piece of writing, a constraint they work under]. I have opinions about it, and I would rather argue them from the inside.</p>
      <p>I would welcome the chance to talk about where I could be most useful in the first six months.</p>
      <p>Thank you for your time,<br>Your name</p>
    `
  }
];

/** Blank-ish documents can be replaced without warning the writer. */
export function isDocumentDisposable(text: string): boolean {
  return text.trim().length === 0;
}
