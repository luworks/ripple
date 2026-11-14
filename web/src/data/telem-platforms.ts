// Telem's 37 platform providers, as listed in docs.telem.ai on Nov 14, 2026.
// mode: what Telem can do inside the platform (search it, fetch from it, or both).
export type Mode = "both" | "fetch" | "search";
export type Platform = { name: string; zh?: string; mode: Mode };
export const platformGroups: { title: string; items: Platform[] }[] = [
	{
		title: "China",
		items: [
			{ name: "Xiaohongshu", zh: "小红书", mode: "both" },
			{ name: "Zhihu", zh: "知乎", mode: "both" },
			{ name: "WeChat articles", zh: "公众号", mode: "both" },
			{ name: "Weibo", zh: "微博", mode: "both" },
			{ name: "Douyin", zh: "抖音", mode: "both" },
			{ name: "Bilibili", zh: "B站", mode: "both" },
			{ name: "Kuaishou", zh: "快手", mode: "both" },
			{ name: "Toutiao", zh: "头条", mode: "both" },
		],
	},
	{
		title: "Social & video",
		items: [
			{ name: "X", mode: "both" },
			{ name: "YouTube", mode: "both" },
			{ name: "LinkedIn", mode: "both" },
			{ name: "TikTok", mode: "both" },
			{ name: "Instagram", mode: "both" },
			{ name: "Telegram", mode: "both" },
			{ name: "Substack", mode: "both" },
			{ name: "Pinterest", mode: "both" },
			{ name: "Lemon8", mode: "both" },
			{ name: "Facebook", mode: "fetch" },
			{ name: "Twitch", mode: "fetch" },
			{ name: "VK", mode: "fetch" },
			{ name: "Snapchat", mode: "fetch" },
			{ name: "Quora", mode: "search" },
		],
	},
	{
		title: "Places & reviews",
		items: [
			{ name: "Google Maps", mode: "both" },
			{ name: "Google Reviews", mode: "both" },
			{ name: "TripAdvisor", mode: "both" },
			{ name: "Trustpilot", mode: "both" },
			{ name: "Airbnb", mode: "both" },
			{ name: "Yelp", mode: "fetch" },
			{ name: "Booking.com", mode: "fetch" },
			{ name: "Glassdoor", mode: "fetch" },
		],
	},
	{
		title: "Shopping & apps",
		items: [
			{ name: "Amazon", mode: "both" },
			{ name: "Product Hunt", mode: "both" },
			{ name: "Google Play", mode: "both" },
			{ name: "App Store", mode: "fetch" },
			{ name: "G2", mode: "fetch" },
		],
	},
	{
		title: "Ad libraries",
		items: [
			{ name: "LinkedIn Ad Library", mode: "both" },
			{ name: "Facebook Ad Library", mode: "both" },
		],
	},
];
