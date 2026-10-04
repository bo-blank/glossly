import type { TemplateText } from './types';

// Every template is a concrete example the writer overwrites: Glossly only has
// something to suggest against once there is prose to select. What each part
// is for lives in `guide`, shown beside the document and never inside it.
// Longer forms name each section by its job in the heading.
export const EN: TemplateText[] = [
  {
    id: 'blank',
    name: 'Blank page',
    blurb: 'Nothing but a cursor.',
    content: '<p></p>',
    guide: []
  },
  {
    id: 'business-email',
    name: 'Business e-mail',
    blurb: 'The ask, the context, the next step.',
    content: `
      <section data-block="Subject">
        <p><strong>Subject:</strong> Moving the review to Thursday — two open points first</p>
      </section>
      <section data-block="First paragraph">
        <p>Hi Priya,</p>
        <p>Could we move Tuesday's review to Thursday at ten? Two points from the last round are still open. I would rather settle them before we show the client the draft.</p>
      </section>
      <section data-block="Context">
        <p>The first is the budget for phase two. The figures we sent in March assumed four workshops; the client now wants six. Either the scope shrinks or the number grows. I think the client should choose.</p>
        <p>The second is the timeline. If the extra workshops stay, the launch moves by about three weeks. I have sketched both versions and attached them, so you can see what each one costs.</p>
      </section>
      <section data-block="Next step">
        <p>If Thursday works for you, I will send the invitation today and update the agenda. If it doesn't, just suggest a time that does.</p>
        <p>Best regards,<br>Alex</p>
      </section>
    `,
    guide: [
      { section: 'Subject', hint: 'Put the ask in the subject line, so the e-mail can be answered from the inbox.' },
      { section: 'First paragraph', hint: 'The ask comes first: what you need, from whom, by when.' },
      { section: 'Context', hint: 'Only the background the reader needs to answer. Everything else goes into an attachment.' },
      { section: 'Next step', hint: 'Say what happens if they agree, and make it easy to say no.' }
    ]
  },
  {
    id: 'cover-letter',
    name: 'Cover letter',
    blurb: 'Why you, why them, why now.',
    content: `
      <section data-block="Opening">
        <p>Dear Ms Berger,</p>
        <p>Your posting for a content lead says that your readers are experts themselves. That is exactly who I have written for over the past six years. I run the newsletter and blog of a mid-sized software company.</p>
      </section>
      <section data-block="Proof">
        <p>My most relevant project there was the newsletter. I turned a monthly product digest into a weekly letter with opinions. Within a year the open rate rose from 21 to 38 percent. Sales started forwarding issues to prospects instead of brochures. What I would bring is less the format than the habit behind it. First decide what a reader should be able to do afterwards. Then cut everything else.</p>
      </section>
      <section data-block="Why them">
        <p>What draws me to your company in particular is your quarterly report. It explains hard trade-offs in plain language without talking down to anyone. That is rarer than it should be. I would like to help more of your writing sound like that.</p>
      </section>
      <section data-block="Close">
        <p>I would be glad to talk about where I could be most useful in the first six months.</p>
        <p>Kind regards,<br>Alex Morgan</p>
      </section>
    `,
    guide: [
      { section: 'Opening', hint: 'Start from something in the posting, not from yourself. It shows you read it.' },
      { section: 'Proof', hint: 'One achievement with a number does more than a list of qualities.' },
      { section: 'Why them', hint: 'Something specific and true about the company. If it would fit any company, cut it.' },
      { section: 'Close', hint: 'Ask for the conversation in one sentence, without apologising.' }
    ]
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    blurb: 'Decisions, owners, deadlines.',
    content: `
      <section data-block="Header">
        <h1>Project sync — 14 October</h1>
        <p><strong>Present:</strong> Priya, Jonas, Mei, Alex · <strong>Notes:</strong> Alex</p>
      </section>
      <section data-block="Agenda items">
        <h2>1. Website relaunch</h2>
        <p>The new page templates are finished and tested in all three browsers. Content migration is behind. About a third of the old pages still need a decision: move, merge or delete.</p>
        <h2>2. Budget for phase two</h2>
        <p>The client wants six workshops instead of four. We will offer two versions and let the client choose. One keeps the original scope and price. The other adds the workshops and launches later.</p>
      </section>
      <section data-block="Decisions">
        <h2>Decisions</h2>
        <ul>
          <li><p>The launch stays on 2 December unless the client picks the larger scope.</p></li>
          <li><p>Pages without an owner by the end of the month are archived, not migrated.</p></li>
        </ul>
      </section>
      <section data-block="Action items">
        <h2>Action items</h2>
        <ul data-type="taskList">
          <li data-type="taskItem" data-checked="false"><p>Priya sends both budget versions to the client by Friday.</p></li>
          <li data-type="taskItem" data-checked="false"><p>Jonas lists the pages without an owner and shares the list by Wednesday.</p></li>
          <li data-type="taskItem" data-checked="false"><p>Mei books a room for the client review on the 28th.</p></li>
        </ul>
        <p><strong>Next meeting:</strong> 21 October, 10:00.</p>
      </section>
    `,
    guide: [
      { section: 'Header', hint: 'Date, who was there, who took the notes: enough to find it again in a year.' },
      { section: 'Agenda items', hint: 'For each item, where things stand, in two or three sentences.' },
      { section: 'Decisions', hint: 'Only what was actually decided, worded so nobody can read it two ways.' },
      { section: 'Action items', hint: 'Every task gets one name and one date, or it will not happen.' }
    ]
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn post',
    blurb: 'Hook, story, takeaway, ask.',
    content: `
      <section data-block="First two lines">
        <p>I spent three years doing this the hard way. Here is what I would tell myself on day one.</p>
        <p>The short version: the thing everyone treats as the hard part is not the hard part.</p>
      </section>
      <section data-block="Story">
        <p>Some context. When I started, I assumed the bottleneck was effort. It was not. Nobody had written down what "done" looked like. So every round of work restarted the argument.</p>
      </section>
      <section data-block="Takeaway">
        <p>Three things changed once we fixed that:</p>
        <ul>
          <li><p>Decisions took hours instead of weeks, because the criteria were on the page.</p></li>
          <li><p>Feedback got specific — people argued with the standard, not with each other.</p></li>
          <li><p>The work got smaller, which made it finishable.</p></li>
        </ul>
        <p>None of this is clever. It is just written down, which turns out to be the rare part.</p>
        <p>If you are in the middle of this right now: write the definition of done first. Everything after it gets cheaper.</p>
      </section>
      <section data-block="Question">
        <p>What is the one thing you wish someone had written down for you?</p>
        <p>#writing #craft #lessons</p>
      </section>
    `,
    guide: [
      { section: 'First two lines', hint: 'Only they show before "see more", so they have to make someone click.' },
      { section: 'Story', hint: 'One concrete situation, told briefly. Readers should recognise their own.' },
      { section: 'Takeaway', hint: 'Three points at most, each a full sentence.' },
      { section: 'Question', hint: 'End with a question people can answer from their own experience.' }
    ]
  },
  {
    id: 'video-script',
    name: 'Video script',
    blurb: 'Hook, sections with shots, call to action.',
    content: `
      <section data-block="Length">
        <h1>Three sentences that make every e-mail shorter</h1>
        <p><strong>Length:</strong> about 75 seconds · <strong>Format:</strong> talking head, vertical 9:16</p>
      </section>
      <section data-block="Hook">
        <h2>0:00–0:05 · Hook</h2>
        <p><em>Shot: close-up, straight into the camera. Caption: "Your e-mails are too long."</em></p>
        <p>Your e-mails are too long. Not because you write badly, but because you start in the wrong place.</p>
      </section>
      <section data-block="Main part">
        <h2>0:05–0:20 · The problem</h2>
        <p><em>Shot: screen recording of a long e-mail, scrolling down.</em></p>
        <p>Most e-mails open with the background: what happened, who said what, why it matters. The actual question arrives in paragraph four, and by then half your readers have stopped reading.</p>
        <h2>0:20–0:55 · The three sentences</h2>
        <p><em>Shot: back to camera. Each sentence appears as a caption.</em></p>
        <p>So turn it around. The first sentence is the ask: what do you need, from whom, by when? The second is the one piece of context nobody can answer without. The third is the next step if the answer is yes.</p>
        <p>Everything else goes into an attachment, or nowhere at all. You will be surprised how often nowhere is enough.</p>
        <h2>0:55–1:10 · Example</h2>
        <p><em>Shot: the long e-mail from the start, rewritten as three sentences.</em></p>
        <p>Here is the e-mail from before. Fourteen lines became three, and the answer came back within the hour.</p>
      </section>
      <section data-block="Call to action">
        <h2>1:10–1:15 · Call to action</h2>
        <p><em>Shot: close-up. Caption: "Ask · Context · Next step".</em></p>
        <p>Try it on the next e-mail you send today, and tell me in the comments how fast the answer came.</p>
      </section>
    `,
    guide: [
      { section: 'Length', hint: 'About 150 spoken words per minute: the script sets the length of the video.' },
      { section: 'Hook', hint: 'The first five seconds decide whether people stay. Name the problem, not yourself.' },
      { section: 'Shots', hint: 'The italic lines are for the edit, not for speaking. Keep them short.', general: true },
      { section: 'Main part', hint: 'Short spoken sentences. Read it aloud once and cut wherever you stumble.' },
      { section: 'Call to action', hint: 'One thing to do, small enough to do today.' }
    ]
  },
  {
    id: 'blog-article',
    name: 'Blog article',
    blurb: 'Problem, idea, practice, objection.',
    content: `
      <section data-block="Title and standfirst">
        <h1>We relaunched our website with half as many pages</h1>
        <p><em>For teams planning a relaunch: which pages to cut, and why less works better.</em></p>
      </section>
      <section data-block="The problem">
        <h2>The problem</h2>
        <p>Our old website had 240 pages. For half of them, nobody remembered who had written them. When customers asked a simple question, even our staff searched in vain.</p>
        <p>This piece is about the one rule that cut the site in half. Nobody missed what we removed.</p>
      </section>
      <section data-block="The background">
        <h2>The background</h2>
        <p>Every one of those pages had once been somebody's good idea. A campaign, a product, a customer's question. In eight years the site only ever grew, because deleting felt riskier than keeping.</p>
      </section>
      <section data-block="The main idea">
        <h2>The main idea</h2>
        <p>A page without an owner does not move. That was the whole rule. Before anything moved, every page needed a named person to keep it current. Whatever nobody claimed by the deadline was archived.</p>
        <blockquote>
          <p>"If nobody will update it, nobody should read it." — our head of customer support, in the meeting where we decided</p>
        </blockquote>
      </section>
      <section data-block="In practice">
        <h2>In practice</h2>
        <ol>
          <li><p>We exported a list of every page with its traffic over the last year. That took an afternoon.</p></li>
          <li><p>The list went to every team, with a request to claim their pages. This is where it usually stalls, so set a firm deadline.</p></li>
          <li><p>We archived the rest and watched the search logs for a month. Three pages came back; 117 did not.</p></li>
        </ol>
      </section>
      <section data-block="The objection">
        <h2>The objection</h2>
        <p>The strongest argument against this is search traffic. Old pages bring visitors, even when they are out of date. We checked. Two thirds of the archived pages had fewer than ten visits a year. The rest now redirect to current pages.</p>
      </section>
      <section data-block="What follows">
        <h2>What follows from this</h2>
        <p>Anyone planning a relaunch should start with the list of owners, not with the design. The smallest version: take your twenty most visited pages. Ask who would notice if one of them were wrong.</p>
      </section>
    `,
    guide: [
      { section: 'Title and standfirst', hint: 'The title promises one thing. The standfirst says who it is for and what they will be able to do.' },
      { section: 'The problem', hint: 'Describe the problem as the reader experiences it, then say what the piece argues.' },
      { section: 'The background', hint: 'Only the context the argument leans on later.' },
      { section: 'The main idea', hint: 'The claim in one sentence, defended with a concrete example or a number.' },
      { section: 'In practice', hint: 'A real case, in order, with enough detail to repeat it.' },
      { section: 'The objection', hint: 'The strongest counter-argument, answered honestly. A straw man reads as a weak argument.' },
      { section: 'What follows', hint: 'End on the reader: one change worth making, and the smallest version of it.' }
    ]
  },
  {
    id: 'newsletter',
    name: 'Newsletter issue',
    blurb: 'Intro, one big thing, links, sign-off.',
    content: `
      <section data-block="Subject">
        <h1>Issue 12 — The meeting that wrote itself</h1>
      </section>
      <section data-block="Intro">
        <p>Hello again,</p>
        <p>This week I sat in a meeting whose notes were finished before it started. That sounds like bureaucracy. It was the opposite, and it is what this issue is about.</p>
      </section>
      <section data-block="The one big thing">
        <h2>The one big thing</h2>
        <p>Our project sync used to run for an hour and produce notes nobody read. Three weeks ago we tried something small. Before each sync, the decisions we expect are already in the notes. The meeting only exists to change them. Last Tuesday it took twenty minutes. Two of the five expected decisions changed, which is exactly the point. We argued with a draft instead of with a blank page.</p>
        <p>I don't think this works for every meeting. It does work for the ones that keep coming back with the same agenda. For me, that is most of them.</p>
      </section>
      <section data-block="Worth your time">
        <h2>Worth your time</h2>
        <ul>
          <li><p><strong>An essay on bad first drafts</strong> — the best argument I know for separating writing from judging.</p></li>
          <li><p><strong>A guide to archiving old pages</strong> — dry, but it saved us a month.</p></li>
          <li><p><strong>A short story about a cancelled train.</strong> Nothing to do with work, which is why it is here.</p></li>
        </ul>
      </section>
      <section data-block="One small thing">
        <h2>One small thing</h2>
        <p>Write the subject line of an e-mail last. Naming something is much easier once you know what it says.</p>
      </section>
      <section data-block="Sign-off">
        <p>That is everything for this week. Reply and tell me what you disagreed with — I read all of them.</p>
        <p>Until next time,<br>Alex</p>
      </section>
    `,
    guide: [
      { section: 'Subject', hint: 'Write it like a sentence someone would say, not like a headline.' },
      { section: 'Intro', hint: 'Two or three sentences: why this topic, why now.' },
      { section: 'The one big thing', hint: 'One centre of gravity per issue, with your own opinion. That is why people subscribe.' },
      { section: 'Worth your time', hint: 'One line per link on why it is here, not a summary of what it says.' },
      { section: 'One small thing', hint: 'A tip, a tool or a line worth stealing, in one paragraph.' },
      { section: 'Sign-off', hint: 'Invite replies. A newsletter people answer is a newsletter people read.' }
    ]
  },
  {
    id: 'essay',
    name: 'Essay',
    blurb: 'A question, an argument, an honest ending.',
    content: `
      <section data-block="The question">
        <h1>The first draft is allowed to be bad</h1>
        <h2>The question</h2>
        <p>Every writer knows the moment. The page is empty. The sentence in your head is perfect; the one on the screen is not. So you delete it and wait for a better one. An hour later the page is still empty. The perfect sentence has gone wherever perfect sentences go.</p>
      </section>
      <section data-block="The argument">
        <h2>The argument</h2>
        <p>The trouble is not a lack of talent. It is a confusion of two jobs. Writing a draft and judging a draft use different parts of the mind. Doing both at once is like driving with one foot on each pedal. The car shakes, and nobody gets anywhere.</p>
        <p>A bad first draft solves this by separating the jobs in time. First you find out what you think, in whatever words arrive. Then, with something on the page, you become the editor. And the editor has it easier: changing is always easier than inventing.</p>
      </section>
      <section data-block="The objection">
        <h2>The objection</h2>
        <p>The obvious objection is that bad drafts waste time. Sometimes they do; whole pages end up deleted. But a deleted page has still done its work if it showed you what the piece was not about. An empty afternoon wastes more, and it teaches nothing.</p>
      </section>
      <section data-block="The ending">
        <h2>The ending</h2>
        <p>None of this means the finished text may be careless. It means the care belongs to the second pass. Write it badly, then make it good — in that order, and not at the same time.</p>
      </section>
    `,
    guide: [
      { section: 'The question', hint: 'Open with a scene or a question readers know from their own life.' },
      { section: 'The argument', hint: 'Name the cause, then the claim. One idea developed, not three listed.' },
      { section: 'The objection', hint: 'Take the strongest counter-argument seriously and grant what is true in it.' },
      { section: 'The ending', hint: 'Come back to the opening and say what changes. No summary.' }
    ]
  },
  {
    id: 'scene',
    name: 'Short story scene',
    blurb: 'A place, two people, something unsaid.',
    content: `
      <section data-block="Setting">
        <h1>Platform Four</h1>
        <p>The last train had been cancelled twenty minutes ago, but neither of them moved. Lena sat on the bench with her coat buttoned to the chin. Tom stood at the edge of the platform. He read the departure board as if it might still change its mind.</p>
      </section>
      <section data-block="Dialogue">
        <p>"We could take a taxi," he said.</p>
        <p>"To where?"</p>
        <p>He didn't answer. Somewhere behind them a vending machine hummed and went quiet. A pigeon walked the length of the yellow line, inspected a crumb, and decided against it.</p>
        <p>"You never told your sister," Lena said. It was not a question, and he didn't treat it as one. He took his hands out of his pockets, looked at them, and put them back.</p>
        <p>"I was going to. Tonight. At dinner."</p>
        <p>"And now there is no dinner."</p>
        <p>"Now there is no train." He almost smiled. "It feels like a sign."</p>
      </section>
      <section data-block="Turn">
        <p>The board flickered. For a moment every line went blank. They both watched it, as though whatever came back would decide for them. Then the old text returned in the same tired orange: cancelled, cancelled, cancelled.</p>
        <p>Lena stood up and brushed off her coat. "Call her," she said. "From here. Before you find another sign."</p>
      </section>
    `,
    guide: [
      { section: 'Setting', hint: 'Start in the middle of the situation. The place in one or two concrete details.' },
      { section: 'Dialogue', hint: 'People rarely say what they mean. Let the important thing stay between the lines.' },
      { section: 'Gesture', hint: 'Show a feeling through what someone does with their hands, not through adjectives.', general: true },
      { section: 'Turn', hint: 'Something small changes at the end: a decision, a look, a sentence.' }
    ]
  }
];
