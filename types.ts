
















export interface FBPage {
    id: string;
    name: string;
    access_token: string;
}

export interface ManagedPost {
    id: string;
    message?: string;
    full_picture?: string;
    permalink_url?: string;
    created_time?: string;
    scheduled_publish_time?: number;
    likes?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
    reactions?: { summary: { total_count: number } };
    insights?: { data: { values: { value: number | { [key: string]: number } }[] }[] };
    attachments?: {
        data: {
            media?: { id?: string; image?: { src: string } };
            subattachments?: {
                data: {
                    media?: { id?: string; image?: { src: string } };
                }[];
            };
        }[];
    };
}

export interface NewsArticleCore {
  long_headline: string;
  summary: string;
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
  // Add other source types if necessary, e.g., newsAagChunk
}

export enum CardDisplayState {
  INITIAL = 'initial', // Before any processing
  AI_IMAGE_LOADING = 'ai_image_loading', // Dedicated AI image (full card) is loading
  AI_IMAGE_LOADED = 'ai_image_loaded', // Dedicated AI image loaded
  AI_IMAGE_FAILED = 'ai_image_failed', // Dedicated AI image generation failed
}

export interface CardStyleSettings {
  headlineFontFamily: SelectedHeadlineFontFamily;
  headlineFontWeight: SelectedFontWeight;
  headlineTextSize: number;
  headlineTextAlign: TextAlign;
  headlineTextWidth: number;
  headlineLetterSpacing: number;
  headlineLineHeight: number;
  headlineHighlightColors: string[];
  headerType: HeaderType;
  selectedHeaderColor: string;
  headerGradientDirection: GradientDirection;
  headerGradientColor1: string;
  headerGradientColor2: string;
  textCase: TextCase;
  showSummary: boolean;
  summaryFontSizeKey: FontSizeKey;
  summaryBackgroundColor: string;
  summaryTextColor: string;
  showSources: boolean;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineType: OutlineType;
  outlineWidth: number;
  outlineRoundedCorners: number;
  outlineOffset: number;
  overlayVisible: boolean;
  overlayPosition: OverlayPosition;
  overlayIsSolid: boolean;
  overlayBackgroundColor: string;
  overlayHeight: number;
  overlayOneSideBorderEnabled: boolean;
  overlayBorderColor: string;
  overlayBorderWidth: number;
  overlayBorderPosition: OverlayBorderPosition;
}


export interface NewsArticle extends NewsArticleCore {
  id: string; // Unique ID for the article
  sources?: GroundingSource[]; // From Gemini grounding
  highlighted_headline_html?: string;
  isHighlighting: boolean;

  style: CardStyleSettings; // Per-card styling
  localImageUrl?: string | null; // User-uploaded background image

  objectAiImageQuery: string | null;
  isObjectAiImageQueryReady: boolean;
  objectAiImageUrl: string | null;
  isObjectAiImageLoading: boolean;
  objectAiImageError: string | null;

  aiImageUrl: string | null; // Dedicated AI generated image for the card background
  isAiImageLoading: boolean;
  aiImageError: string | null;

  displayState: CardDisplayState;
}

export interface ViralPost {
  id: string;
  topic: string;
  headline: string;
  summary: string;
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

export type CardData = (NewsArticle & { type: 'news' }) | (ViralPost & { type: 'viral' });

// --- NEW FEED POST TYPE ---
export interface FeedPost {
    id: string; // The firebase key
    uid: string;
    authorName: string;
    caption: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'audio';
    timestamp: number;
    likes: Record<string, boolean>; // a dictionary of user uids who liked it
}


export const HeadlineFontOptions = {
  'Inter, sans-serif': "Inter",
  '"Alegreya Sans SC", sans-serif': "Alegreya Sans SC",
  'Amaranth, sans-serif': "Amaranth",
  'Boogaloo, cursive': "Boogaloo",
  'Khand, sans-serif': "Khand",
  '"Rozha One", serif': "Rozha One",
  'Alegreya, serif': "Alegreya (Serif)",
  'Teko, sans-serif': "Teko",
};
export type SelectedHeadlineFontFamily = keyof typeof HeadlineFontOptions;

export const FontWeightOptions = {
  '300': 'Light (300)',
  'normal': 'Normal (400)',
  '500': 'Medium (500)',
  '600': 'Semi-Bold (600)',
  'bold': 'Bold (700)',
  '800': 'Extra-Bold (800)',
};
export type SelectedFontWeight = keyof typeof FontWeightOptions;

export enum ContentType {
  News = "news",
  Facts = "facts",
}

export const ContentCategory = {
  // Religions & Philosophy
  ISLAM: "Islam",
  CHRISTIANITY: "Christianity",
  HINDUISM: "Hinduism",
  BUDDHISM: "Buddhism",
  JUDAISM: "Judaism",
  SIKHISM: "Sikhism",
  SPIRITUALITY: "Spirituality",
  PHILOSOPHY: "Philosophy",
  ATHEISM: "Atheism",
  MYTHOLOGY: "Mythology",
  // Society & Culture
  SOCIAL_JUSTICE: "Social Justice",
  HUMAN_RIGHTS: "Human Rights",
  POLITICS: "Politics",
  CORRUPTION: "Corruption",
  WEALTH_DISPARITY: "Wealth Disparity",
  CULTURAL_TRADITIONS: "Cultural Traditions",
  // News & World Affairs
  WORLD_AFFAIRS: "World Affairs",
  BIZARRE_NEWS: "Bizarre News",
  SCAMS: "Scams",
  CONSPIRACY_THEORIES: "Conspiracy Theories",
  UNEXPLAINED_MYSTERIES: "Unexplained Mysteries",
  // Science & Technology
  TECHNOLOGY: "Technology",
  ARTIFICIAL_INTELLIGENCE: "Artificial Intelligence",
  SPACE_EXPLORATION: "Space Exploration",
  QUANTUM_PHYSICS: "Quantum Physics",
  BIOTECH: "Bio-Tech",
  ENVIRONMENT: "Environment",
  SCIENCE: "Science",
  GADGETS: "Gadgets",
  // Business & Finance
  BUSINESS: "Business",
  FINANCE: "Finance",
  STOCKS: "Stocks",
  CRYPTO: "Crypto",
  // Health & Lifestyle
  HEALTH: "Health",
  MENTAL_HEALTH: "Mental Health",
  FITNESS: "Fitness",
  FOOD_DRINK: "Food & Drink",
  TRAVEL: "Travel",
  FASHION: "Fashion",
  // Personal Development
  SELF_IMPROVEMENT: "Self-Improvement",
  LIFE_HACKS: "Life Hacks",
  PRODUCTIVITY: "Productivity",
  RELATIONSHIPS: "Relationships",
  STOICISM: "Stoicism",
  // Entertainment
  ENTERTAINMENT: "Entertainment",
  HOLLYWOOD: "Hollywood",
  BOLLYWOOD: "Bollywood",
  GAMING: "Gaming",
  SPORTS: "Sports",
  // History & General Knowledge
  HISTORY: "History",
  HISTORICAL_EVENTS: "Historical Events",
  ANCIENT_CIVILIZATIONS: "Ancient Civilizations",
  WORLD_RECORDS: "World Records",
  GENERAL: "General",
  ANIMALS: "Animals",
  WEATHER: "Weather",
  CARS: "Cars",
  FOLKLORE: "Folklore",
  PARENTING: "Parenting",
  DIY: "DIY"
};
export type ContentCategoryKey = keyof typeof ContentCategory;
export type ContentCategoryValue = typeof ContentCategory[ContentCategoryKey];

export const Emotions = {
    Neutral: '😐 Neutral',
    Happiness: '😊 Happiness',
    Sadness: '😢 Sadness',
    Fear: '😨 Fear',
    Anger: '😡 Anger',
    Surprise: '😲 Surprise',
    Disgust: '🤢 Disgust',
    Joy: '😄 Joy',
    Love: '❤️ Love',
    Gratitude: '🙏 Gratitude',
    Hope: '🙌 Hope',
    Awe: '🤩 Awe',
    Amusement: '😂 Amusement',
    Serenity: '😌 Serenity',
    Anxiety: '😰 Anxiety',
    Guilt: '😥 Guilt',
    Shame: '😳 Shame',
    Jealousy: '😒 Jealousy',
    Frustration: '😤 Frustration',
    Loneliness: '😔 Loneliness',
    Bittersweet: ' bittersweet',
    Nostalgia: '🏞️ Nostalgia',
    Contempt: '😏 Contempt',
    Trust: '🤝 Trust',
    Anticipation: '🤔 Anticipation',
};
export type SelectedEmotion = keyof typeof Emotions;

export const LanguageOptions = {
  'en': "English",
  'hi': "Hindi",
  'ar': "Arabic",
  'ur': "Urdu",
  'es': "Spanish",
  'fr': "French",
  'de': "German",
  'ja': "Japanese",
  'pt': "Portuguese",
  'ru': "Russian",
  'zh': "Chinese",
};
export type SelectedLanguageCode = keyof typeof LanguageOptions;

export const CountryOptions = {
  'WW': "Worldwide",
  'US': "United States",
  'IN': "India",
  'GB': "United Kingdom",
  'CA': "Canada",
  'AU': "Australia",
  'PK': "Pakistan",
  'AE': "United Arab Emirates",
  'SA': "Saudi Arabia",
};
export type SelectedCountryCode = keyof typeof CountryOptions;

export const FontSizeOptions = {
  small: { summary: 'text-xs', tailwindClass: 'text-xs' },
  medium: { summary: 'text-sm', tailwindClass: 'text-sm' },
  large: { summary: 'text-base', tailwindClass: 'text-base' },
};
export type FontSizeKey = keyof typeof FontSizeOptions;

export enum TextCase {
  Default = 'default', // No transformation class
  Uppercase = 'uppercase', // Tailwind 'uppercase'
}

export enum OutlineType {
  Solid = 'solid',
  Dotted = 'dotted',
  Dashed = 'dashed',
}

export type TextAlign = 'left' | 'center' | 'right';

export type OverlayPosition = 'top' | 'bottom' | 'left' | 'right';
export type OverlayBorderPosition = 'top' | 'bottom' | 'left' | 'right';

export const DEFAULT_HIGHLIGHT_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F1C40F', '#9B59B6'];
export const MAX_HIGHLIGHT_COLORS = 8;
export const MIN_HIGHLIGHT_COLORS = 1;

export enum HeaderType {
  Solid = "solid",
  Gradient = "gradient",
}

export const GradientDirectionOptions = {
  'to top': 'To Top',
  'to top right': 'To Top Right',
  'to right': 'To Right',
  'to bottom right': 'To Bottom Right',
  'to bottom': 'To Bottom',
  'to bottom left': 'To Bottom Left',
  'to left': 'To Left',
  'to top left': 'To Top Left',
  '45deg': '45 Degrees',
  '90deg': '90 Degrees',
  '135deg': '135 Degrees',
  '180deg': '180 Degrees',
  '225deg': '225 Degrees',
  '270deg': '270 Degrees',
  '315deg': '315 Degrees',
} as const;
export type GradientDirection = keyof typeof GradientDirectionOptions;


export interface AppSettings extends CardStyleSettings {
  postCount: number;
  selectedContentType: ContentType;
  selectedContentCategory: ContentCategoryValue;
  selectedLanguage: SelectedLanguageCode;
  selectedCountryCode: SelectedCountryCode;
  selectedEmotion: SelectedEmotion;
}

// Type for the new Settings Context
export interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}


// Helper to get country name from code
export const getCountryName = (code: SelectedCountryCode): string => {
  return CountryOptions[code] || "Worldwide";
};

// Helper to get language name from code
export const getLanguageName = (code: SelectedLanguageCode): string => {
  return LanguageOptions[code] || "English";
};

// Theme Customization Types
export const GlobalFontOptions = {
  'Inter, sans-serif': "Inter",
  '"Roboto", sans-serif': "Roboto",
  '"Open Sans", sans-serif': "Open Sans",
  '"Lato", sans-serif': "Lato",
  '"Merriweather", serif': "Merriweather",
  '"Nunito Sans", sans-serif': "Nunito Sans",
  'Verdana, sans-serif': "Verdana",
  'Georgia, serif': "Georgia",
};
export type SelectedGlobalFontFamily = keyof typeof GlobalFontOptions;

export interface AppThemeSettings {
  globalFontFamily: SelectedGlobalFontFamily;
  primaryColor: string;
  backgroundType: 'solid' | 'gradient';
  backgroundSolidColor: string;
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
  backgroundGradientDirection: GradientDirection;
}

export const DEFAULT_THEME_SETTINGS: AppThemeSettings = {
  globalFontFamily: 'Inter, sans-serif',
  primaryColor: '#009dff', // New Default Blue
  backgroundType: 'solid',
  backgroundSolidColor: '#F3F4F6', // Default Gray-100
  backgroundGradientStart: '#8EC5FC',
  backgroundGradientEnd: '#E0C3FC',
  backgroundGradientDirection: 'to bottom right',
};

// Type for AI prompt processing
export interface AiProcessedPrompt {
  action: 'update_settings' | 'generate_content' | 'answer_question';
  settings?: Partial<AppSettings>;
  content_prompt?: string;
  answer?: string;
}

// --- API KEY MANAGEMENT ---
export interface ApiKey {
  id: string;
  provider: 'gemini' | 'chatgpt';
  key: string;
  isActive: boolean;
  name: string;
}


// --- PAGE INSIGHTS TYPES ---
export interface InsightDataPoint {
    date: string;
    value: number;
}

export interface TopEngagingPost {
    id: string;
    message: string;
    thumbnail: string;
    reach: number;
    engagement: number;
    likes: number;
    comments: number;
}

export interface PageInsightsSummary {
    totalFollowers: number;
    newFollowers: number;
    totalReach: number;
    totalEngagement: number;
    followerChartData: InsightDataPoint[];
    topPosts: TopEngagingPost[];
}

// --- MESSAGES TYPES ---
export interface Message {
    id: string;
    created_time: string;
    from: {
        name: string;
        id: string;
    };
    message: string;
    isOptimistic?: boolean; // For UI updates before API confirmation
    attachments?: {
        data: {
            id: string;
            mime_type: string;
            image_data?: { url: string };
            file_url?: string; // For other file types
        }[];
    };
}

export interface Conversation {
    id: string;
    participants: {
        data: {
            name: string;
            id: string;
        }[];
    };
    messages: {
        data: Message[];
    };
    unread_count: number;
    customerName?: string; // Helper property
    isWithin24HourWindow?: boolean;
}

// For recreating viral posts from an image
export interface ViralRecreationContent {
  headline: string;
  summary: string;
  image_prompt: string;
}


// --- COLOR UTILITIES ---

export function isValidHexColor(hex: string): boolean {
  if (!hex || typeof hex !== 'string') return false;
  const strippedHex = hex.replace(/^#/, '');
  return /^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(strippedHex);
}

// Utility to generate a darker shade for hover effects
export function darkenColor(hex: string, percent: number): string {
  if (!isValidHexColor(hex)) {
    return hex;
  }
  const strippedHex = hex.replace(/^#/, '');
  const fullHex = strippedHex.length === 3 
      ? strippedHex.split('').map(char => char + char).join('') 
      : strippedHex;

  let r = parseInt(fullHex.substring(0, 2), 16);
  let g = parseInt(fullHex.substring(2, 4), 16);
  let b = parseInt(fullHex.substring(4, 6), 16);

  r = Math.max(0, Math.floor(r * (1 - percent / 100)));
  g = Math.max(0, Math.floor(g * (1 - percent / 100)));
  b = Math.max(0, Math.floor(b * (1 - percent / 100)));

  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

// Gets a contrasting text color (black or white) for a given hex background
export function getContrastingTextColor(hex: string): string {
    if (!isValidHexColor(hex)) {
        return '#ffffff'; // Default to white for invalid colors
    }
    const strippedHex = hex.replace(/^#/, '');
    const fullHex = strippedHex.length === 3 
        ? strippedHex.split('').map(char => char + char).join('') 
        : strippedHex;
        
    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);

    // Using the W3C contrast ratio formula (simplified)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    
    // If luminance is high, it's a light color, so we want dark text.
    // If luminance is low, it's a dark color, so we want light text.
    return luminance > 128 ? '#000000' : '#ffffff';
}


export function hexToRgba(hex: string, alpha: number): string {
  if (!isValidHexColor(hex)) {
    console.warn(`Invalid hex color encountered in hexToRgba: ${hex}. Defaulting to transparent black.`);
    return `rgba(0, 0, 0, ${Math.max(0, Math.min(1, alpha))})`; 
  }
  const strippedHex = hex.replace(/^#/, '');
  const fullHex = strippedHex.length === 3 
    ? strippedHex.split('').map(char => char + char).join('') 
    : strippedHex;

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}