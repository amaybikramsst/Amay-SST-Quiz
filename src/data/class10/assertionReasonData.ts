export type Class10Subject = "History" | "Geography" | "Civics" | "Economics";

export type ARStandardOption = "A" | "B" | "C" | "D";

export interface ARQuestion {
  id: string;
  subject: Class10Subject;
  chapter: string;
  assertion: string;
  reason: string;
  isAssertionTrue: boolean;
  isReasonTrue: boolean;
  doesReasonExplain: boolean; // Only evaluated when both A and R are true
  correctOption: ARStandardOption;
  ncertExplanation: string;
  conceptSummary: string;
}

export const CLASS_10_AR_QUESTIONS: ARQuestion[] = [
  // ==========================================
  // CIVICS / POLITICAL SCIENCE
  // ==========================================
  {
    id: "ar-civ-1",
    subject: "Civics",
    chapter: "Chapter 1: Power Sharing",
    assertion: "Power sharing is good for democracies.",
    reason: "It helps to reduce the possibility of conflict between social groups.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "Social conflicts often lead to violence and political instability. Power sharing is a good way to ensure political stability (Prudential reason).",
    conceptSummary: "Power sharing ensures stability and respects the spirit of democracy.",
  },
  {
    id: "ar-civ-2",
    subject: "Civics",
    chapter: "Chapter 1: Power Sharing",
    assertion: "In Belgium, the leaders recognized the existence of regional differences and cultural diversities.",
    reason: "Between 1970 and 1993, they amended their constitution four times to work out an arrangement enabling everyone to live together.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "The Belgian model equalized Dutch and French-speaking ministers in the central government and gave autonomy to regions to prevent civil strife.",
    conceptSummary: "Belgian accommodation is celebrated globally for inclusive power-sharing.",
  },
  {
    id: "ar-civ-3",
    subject: "Civics",
    chapter: "Chapter 2: Federalism",
    assertion: "India is a federation with a 'holding together' arrangement.",
    reason: "In a holding together federation, the central government tends to be more powerful vis-à-vis the states.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "When a large country divides power between constituent states and the national government, it is 'holding together', where the center is typically stronger.",
    conceptSummary: "Unlike the USA ('coming together'), India, Spain, and Belgium are 'holding together' federations.",
  },
  {
    id: "ar-civ-4",
    subject: "Civics",
    chapter: "Chapter 4: Gender, Religion and Caste",
    assertion: "Communalism is based on the idea that religion is the principal basis of social community.",
    reason: "People of one religion have identical interests in all contexts.",
    isAssertionTrue: true,
    isReasonTrue: false,
    doesReasonExplain: false,
    correctOption: "C",
    ncertExplanation: "Assertion is true as communal politics rests on religion. Reason is false: within the same religion, people have diverse economic statuses, castes, and political opinions.",
    conceptSummary: "Communalism assumes uniformity among religious followers, which does not exist in reality.",
  },

  // ==========================================
  // HISTORY
  // ==========================================
  {
    id: "ar-hist-1",
    subject: "History",
    chapter: "Chapter 2: Nationalism in India",
    assertion: "Mahatma Gandhi decided to call off the Non-Cooperation Movement in February 1922.",
    reason: "At Chauri Chaura in Gorakhpur, a peaceful demonstration turned into a violent clash with the police, burning 22 policemen alive.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "Gandhi felt the movement was turning violent in many places and satyagrahis needed to be properly trained before mass struggles.",
    conceptSummary: "Chauri Chaura directly convinced Gandhi to call off the Non-Cooperation Movement.",
  },
  {
    id: "ar-hist-2",
    subject: "History",
    chapter: "Chapter 2: Nationalism in India",
    assertion: "The Simon Commission was boycotted by all political parties in India.",
    reason: "The commission did not have a single Indian member; they were all British.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "Indians felt insulted that an all-White statutory commission arrived to decide the constitutional future of India without Indian representation.",
    conceptSummary: "'Go Back Simon' slogans and black flags united Indian leaders across parties.",
  },
  {
    id: "ar-hist-3",
    subject: "History",
    chapter: "Chapter 1: The Rise of Nationalism in Europe",
    assertion: "The Civil Code of 1804 (Napoleonic Code) established equality before the law.",
    reason: "It abolished all feudal privileges based on birth and secured the right to property.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "Napoleon introduced revolutionary principles in administration to make the whole system more rational and efficient.",
    conceptSummary: "The Napoleonic Code dismantled aristocratic privileges across French-controlled Europe.",
  },
  {
    id: "ar-hist-4",
    subject: "History",
    chapter: "Chapter 5: Print Culture and the Modern World",
    assertion: "Martin Luther declared: 'Print is the ultimate gift of God and the greatest one.'",
    reason: "Printing destroyed the Roman Catholic Church permanently across Europe.",
    isAssertionTrue: true,
    isReasonTrue: false,
    doesReasonExplain: false,
    correctOption: "C",
    ncertExplanation: "Assertion is true: Luther praised print because his 95 Theses reached thousands in days. Reason is false: it led to the Protestant Reformation and division, not the permanent destruction of the Catholic Church.",
    conceptSummary: "Print fueled the Reformation by decentralizing reading of religious scriptures.",
  },

  // ==========================================
  // GEOGRAPHY
  // ==========================================
  {
    id: "ar-geo-1",
    subject: "Geography",
    chapter: "Chapter 1: Resources and Development",
    assertion: "Alluvial soil is ideal for the growth of sugarcane, paddy, wheat, and other cereal and pulse crops.",
    reason: "Alluvial soil is rich in potash, phosphoric acid, and lime.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "The rich mineral composition (potash, phosphoric acid, lime) makes alluvial soil fertile, supporting intensive agriculture and high population density.",
    conceptSummary: "Alluvial soil is the most widespread and productive soil in India.",
  },
  {
    id: "ar-geo-2",
    subject: "Geography",
    chapter: "Chapter 3: Water Resources",
    assertion: "Multi-purpose projects and large dams have come under great scrutiny and opposition.",
    reason: "Regulating and damming rivers affects their natural flow, causing excessive sedimentation at the reservoir bottom and fragmenting aquatic ecosystems.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "Large dams cause ecological problems, submerge vegetation, and induce seismic activity, leading to public resistance like Narmada Bachao Andolan.",
    conceptSummary: "Dams provide irrigation and electricity, but carry heavy ecological and displacement costs.",
  },
  {
    id: "ar-geo-3",
    subject: "Geography",
    chapter: "Chapter 4: Agriculture",
    assertion: "Tea cultivation is an example of plantation agriculture.",
    reason: "In plantation agriculture, a single crop is grown on a large area using capital intensive inputs and migrant labor.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "Plantation covers large tracts using scientific methods, and all produce is processed on the estate or nearby factories.",
    conceptSummary: "Tea, coffee, and rubber in India are prominent commercial plantation crops.",
  },
  {
    id: "ar-geo-4",
    subject: "Geography",
    chapter: "Chapter 7: Lifelines of National Economy",
    assertion: "Pipeline transport network is a new arrival on the transportation map of India.",
    reason: "Initial cost of laying pipelines is low, but subsequent running costs are very high.",
    isAssertionTrue: true,
    isReasonTrue: false,
    doesReasonExplain: false,
    correctOption: "C",
    ncertExplanation: "Assertion is true. Reason is false because the initial cost of laying pipelines is high, but subsequent running costs are minimal and trans-shipment losses/delays are ruled out.",
    conceptSummary: "Pipelines efficiently transport crude oil, petroleum products, and natural gas.",
  },

  // ==========================================
  // ECONOMICS
  // ==========================================
  {
    id: "ar-eco-1",
    subject: "Economics",
    chapter: "Chapter 1: Development",
    assertion: "Different persons can have different development goals.",
    reason: "What may be development for one may not be development for another; it may even be destructive for the other.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "For instance, an industrialist may want more dams for electricity, but this submerges the land of displaced tribals whose livelihood is lost.",
    conceptSummary: "Development goals are conflicting and vary with individuals' socioeconomic situations.",
  },
  {
    id: "ar-eco-2",
    subject: "Economics",
    chapter: "Chapter 2: Sectors of the Indian Economy",
    assertion: "Tertiary sector activities, by themselves, do not produce a good.",
    reason: "They are an aid or support for the production process generated in Primary and Secondary sectors.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "Transport, banking, warehousing, and communication are services that help move and sell goods rather than manufacturing tangible commodities.",
    conceptSummary: "The Tertiary sector is also called the Service sector.",
  },
  {
    id: "ar-eco-3",
    subject: "Economics",
    chapter: "Chapter 3: Money and Credit",
    assertion: "Banks charge a higher interest rate on loans than what they offer on deposits.",
    reason: "The difference between what is charged from borrowers and what is paid to depositors is their main source of income.",
    isAssertionTrue: true,
    isReasonTrue: true,
    doesReasonExplain: true,
    correctOption: "A",
    ncertExplanation: "This interest spread covers operating costs and constitutes the operational profit/income for commercial banks.",
    conceptSummary: "Net interest margin is the primary revenue model of commercial banks.",
  },
  {
    id: "ar-eco-4",
    subject: "Economics",
    chapter: "Chapter 4: Globalisation and the Indian Economy",
    assertion: "A Multinational Corporation (MNC) is a company that owns or controls production in only one country.",
    reason: "MNCs set up offices and factories for production in regions where they can get cheap labor and other resources.",
    isAssertionTrue: false,
    isReasonTrue: true,
    doesReasonExplain: false,
    correctOption: "D",
    ncertExplanation: "Assertion is false: an MNC controls production in more than one nation. Reason is true: MNCs locate production where costs are lowest to maximize profit.",
    conceptSummary: "MNCs globalize production to minimize costs and access worldwide consumer markets.",
  },
];
