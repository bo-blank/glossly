export type TemplateGroup = 'work' | 'publishing' | 'fiction';

/** What one part of a template is for. Shown beside the document, never in it. */
export interface GuideNote {
  section: string;
  hint: string;
  /** Applies to the whole text, so no block carries this name (e.g. the shot lines of a video script). */
  general?: boolean;
}

/** One template in one language. The same id exists in every language. */
export interface TemplateText {
  id: string;
  name: string;
  blurb: string;
  content: string;
  /** Empty for the blank page. */
  guide: GuideNote[];
}
