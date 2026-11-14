// Timeline of the Jensen Huang resignation, compiled from news coverage found through Telem
// web search on 2026-11-14. Every entry cites the reports it rests on.

export type Source = { label: string; url: string };

export type TimelineEvent = {
	date: string; // ISO date (YYYY-MM-DD); approximate dates use the first of the month
	when: string; // display label
	phase: "background" | "scandal" | "resignation" | "aftermath" | "upcoming";
	title: string;
	detail: string;
	sources: Source[];
};

export const keyFacts = [
	{
		label: "Resigned",
		value: "Nov 12, 2026",
		note: "Board accepted on Nov 11",
	},
	{ label: "Tenure", value: "33 years", note: "Co-founder, CEO since 1993" },
	{ label: "Interim CEO", value: "Colette Kress", note: "Stays CFO as well" },
	{
		label: "New board chair",
		value: "Harvey C. Jones",
		note: "Nvidia's first chair",
	},
	{
		label: "Stock on Nov 12",
		value: "−4%+",
		note: "Below $4T market cap on Nov 13",
	},
];

export const timeline: TimelineEvent[] = [
	{
		date: "2023-03-01",
		when: "2023",
		phase: "background",
		title: "Megaspeed is set up in Singapore",
		detail:
			"Megaspeed is spun out of the Chinese game company 7Road. Alice Huang (Huang Le, no relation to Jensen Huang) runs the new data center firm. It goes on to buy billions of dollars of Nvidia AI chips; TechCrunch puts the total at $4.8B over two years.",
		sources: [
			{
				label: "The Guardian",
				url: "https://www.theguardian.com/technology/2026/nov/12/jensen-huang-affair-timeline",
			},
			{
				label: "NYT",
				url: "https://www.nytimes.com/2026/11/12/business/nvidia-jensen-huang-affairs-timeline.html",
			},
		],
	},
	{
		date: "2023-12-01",
		when: "Dec 2023 – Jun 2024",
		phase: "background",
		title: "Jensen Huang and Alice Huang are seen together",
		detail:
			"The two have dinner with colleagues in Singapore in December 2023 and are seen at an event in Taipei in June 2024, according to the New York Times.",
		sources: [
			{
				label: "NYT",
				url: "https://www.nytimes.com/2026/11/12/business/nvidia-jensen-huang-affairs-timeline.html",
			},
		],
	},
	{
		date: "2024-06-01",
		when: "Jun 2024 – Jun 2025",
		phase: "background",
		title:
			"More than 200 shipments of Nvidia gear reach a Megaspeed subsidiary",
		detail:
			"US and Singapore authorities later investigate whether Megaspeed sent export-restricted Nvidia chips on to customers in China. Megaspeed denies it.",
		sources: [
			{
				label: "NYT",
				url: "https://www.nytimes.com/2026/11/12/business/nvidia-jensen-huang-affairs-timeline.html",
			},
			{
				label: "Fortune",
				url: "https://fortune.com/2026/11/11/megaspeed-nvidia-chips-china-singapore-malaysia/",
			},
		],
	},
	{
		date: "2025-02-01",
		when: "Feb 2025 – Feb 2026",
		phase: "background",
		title: "Singapore investigates Megaspeed",
		detail:
			"Singapore police and customs open an inquiry in February 2025 into possible false declarations on server purchases. They hold Alice Huang's passport, find insufficient evidence to charge her, and return the passport on Feb 26, 2026. She leaves Singapore that day.",
		sources: [
			{
				label: "Singapore MHA",
				url: "https://www.mha.gov.sg/media-room/newsroom/singapore-investigations-into-alice-huang-huang-le-and-megaspeed-international-pte-ltd/",
			},
			{
				label: "Business Times",
				url: "https://www.businesstimes.com.sg/singapore/singapore-bars-alice-huang-woman-tied-affair-nvidias-jensen-huang-misleading-police",
			},
		],
	},
	{
		date: "2026-10-29",
		when: "Oct 29, 2026",
		phase: "scandal",
		title:
			"NYT: US officials believe Alice Huang is a Chinese intelligence asset",
		detail:
			"The New York Times reports that US authorities investigated Alice Huang, who had a close relationship with Jensen Huang, on suspicion of passing intelligence to Beijing and helping get around AI chip export rules. China calls the claims a smear. Reuters later reports that in October Huang described the relationship to company leaders as appropriate.",
		sources: [
			{
				label: "CNA",
				url: "https://www.channelnewsasia.com/east-asia/jensen-huang-affair-alice-huang-nvidia-timeline-6535611",
			},
			{
				label: "Reuters",
				url: "https://www.reuters.com/5f374b32b07b/world/china/ex-nvidia-ceo-misled-top-lawyer-affair-with-chinese-businesswoman-sources-say-2026-11-14/",
			},
		],
	},
	{
		date: "2026-11-08",
		when: "Sun, Nov 8",
		phase: "scandal",
		title: "Huang admits an affair; the board opens an investigation",
		detail:
			"In an email to staff, Huang writes, “I was unfaithful to my wife… I take full responsibility.” The board starts an independent investigation into reports that he was “the target of a foreign intelligence effort.” It says it has no reason to believe national security or company secrets were compromised and that it still has confidence in him.",
		sources: [
			{
				label: "Nvidia board statement",
				url: "https://nvidianews.nvidia.com/news/statement-from-nvidia-board-of-directors",
			},
			{
				label: "Axios (full email)",
				url: "https://www.axios.com/2026/11/08/nvidia-ceo-jensen-huang-affair-email-to-company",
			},
		],
	},
	{
		date: "2026-11-09",
		when: "Mon, Nov 9",
		phase: "scandal",
		title: "Stock falls 4%; NYT reports a halted Commerce inquiry",
		detail:
			"Nvidia shares drop about 4% as investors weigh the risk to its leadership. The NYT reports that a Commerce Department investigation into Megaspeed was halted after Nvidia stepped in. President Trump says the FBI is looking into the affair.",
		sources: [
			{
				label: "CNBC",
				url: "https://www.cnbc.com/2026/11/09/nvidia-jensen-huang-chinese-spy-investigation.html",
			},
			{
				label: "NYT",
				url: "https://www.nytimes.com/2026/11/09/business/economy/nvidia-megaspeed-investigation-huang.html",
			},
			{
				label: "AP",
				url: "https://apnews.com/article/china-denies-spy-jensen-huang-nvidia-3345b9f05c54d58909e88f6dcb9c1cd8",
			},
		],
	},
	{
		date: "2026-11-10",
		when: "Tue, Nov 10",
		phase: "scandal",
		title: "Board hires Wachtell Lipton to lead the probe",
		detail:
			"The investigation will look at whether company secrets or national security were compromised.",
		sources: [
			{
				label: "CNBC",
				url: "https://www.cnbc.com/2026/11/10/nvidia-wachtell-lipton-huang-affair.html",
			},
		],
	},
	{
		date: "2026-11-11",
		when: "Wed, Nov 11",
		phase: "resignation",
		title:
			"A second relationship is reported; the board accepts his resignation",
		detail:
			"Citing five people who worked at Nvidia, the NYT reports that Huang also had a relationship with an executive who reports directly to him. Nvidia has not confirmed it. Trump says he spoke to Huang that day and had urged him to fight for his job. That evening, after a board meeting that ran late, the board accepts Huang's resignation, according to the SEC filing.",
		sources: [
			{
				label: "NYT",
				url: "https://www.nytimes.com/2026/11/11/technology/jensen-huang-nvidia-affair.html",
			},
			{
				label: "SEC 8-K",
				url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000082/nvda-20261111.htm",
			},
			{
				label: "The Hill",
				url: "https://thehill.com/homenews/administration/6217994-trump-nvidia-ceo-huang-resignation/",
			},
		],
	},
	{
		date: "2026-11-12",
		when: "Thu, Nov 12",
		phase: "resignation",
		title: "Nvidia announces the CEO transition",
		detail:
			"Huang steps down as president, CEO and director, effective immediately. CFO Colette Kress becomes interim CEO and Harvey C. Jones becomes the company's first board chair. The announcement gives no reason. The stock closes down more than 4%.",
		sources: [
			{
				label: "Nvidia newsroom",
				url: "https://nvidianews.nvidia.com/news/nvidia-announces-ceo-transition",
			},
			{
				label: "CNBC",
				url: "https://www.cnbc.com/2026/11/12/nvidia-nvda-jensen-huang-second-affair.html",
			},
		],
	},
	{
		date: "2026-11-12",
		when: "Thu, Nov 12",
		phase: "resignation",
		title: "Huang agrees to testify; Singapore bars Alice Huang",
		detail:
			"Huang agrees to testify before the House Foreign Affairs Committee after a letter from three GOP committee chairs. Singapore's Ministry of Home Affairs bars Alice Huang from re-entering the country for giving police inaccurate information. Trump suggests Apple's Tim Cook should run Nvidia.",
		sources: [
			{
				label: "Politico",
				url: "https://www.politico.com/news/2026/11/12/jensen-huang-agrees-to-testify-01162650",
			},
			{
				label: "Business Times",
				url: "https://www.businesstimes.com.sg/singapore/singapore-bars-alice-huang-woman-tied-affair-nvidias-jensen-huang-misleading-police",
			},
			{
				label: "USA Today",
				url: "https://www.usatoday.com/story/news/politics/2026/11/12/trump-apple-tim-cook-jensen-huang-nvidia-resignation/92741233007",
			},
		],
	},
	{
		date: "2026-11-13",
		when: "Fri, Nov 13",
		phase: "aftermath",
		title: "Market cap falls below $4T; employees push back",
		detail:
			"Nvidia closes below a $4 trillion market value for the first time since July 2025. WIRED reports more than 1,600 internal messages urging the board to bring Huang back. Reuters reports he misled company leaders about the nature of the relationship.",
		sources: [
			{
				label: "CNBC",
				url: "https://www.cnbc.com/2026/11/13/nvidia-nvda-stock-jensen-huang-transition.html",
			},
			{
				label: "WIRED",
				url: "https://www.wired.com/story/nvidia-employees-petition-for-jensen-huangs-return/",
			},
			{
				label: "Reuters",
				url: "https://www.reuters.com/5f374b32b07b/world/china/ex-nvidia-ceo-misled-top-lawyer-affair-with-chinese-businesswoman-sources-say-2026-11-14/",
			},
		],
	},
	{
		date: "2026-11-14",
		when: "Sat, Nov 14",
		phase: "aftermath",
		title: "Investors and a petition call for his return",
		detail:
			"Altimeter's Brad Gerstner and Atreides' Gavin Baker, who together disclosed about $2.13B of Nvidia stock, ask the board for a slow CEO search that leaves room for Huang to return. The “Stand with Jensen” petition passes about 100,000 signatures, with support from Elon Musk. Organizers say they are removing fake entries.",
		sources: [
			{
				label: "CNBC",
				url: "https://www.cnbc.com/2026/11/14/nvidia-investors-jensen-huang-return-board-letter.html",
			},
			{
				label: "Business Insider",
				url: "https://www.businessinsider.com/petition-reinstate-jensen-huang-nvidia-elon-musk-2026-11",
			},
		],
	},
	{
		date: "2026-11-17",
		when: "Tue, Nov 17",
		phase: "upcoming",
		title: "Q3 earnings, Kress's first call as interim CEO",
		detail:
			"Investors will be watching guidance, the CEO search, and whether customers are affected.",
		sources: [
			{
				label: "Economic Times",
				url: "https://economictimes.indiatimes.com/news/international/us/five-days-after-becoming-nvidia-interim-ceo-colette-kress-will-face-her-first-nvda-earnings-report-without-jensen-huang-on-november-17/articleshow/135777510.cms",
			},
		],
	},
	{
		date: "2026-11-25",
		when: "Before Thanksgiving",
		phase: "upcoming",
		title: "Congressional testimony",
		detail:
			"The time and format of Huang's appearance before House lawmakers are still being worked out.",
		sources: [
			{
				label: "CNBC live",
				url: "https://www.cnbc.com/2026/11/12/nvidia-jensen-huang-ceo-live-updates.html",
			},
		],
	},
];
