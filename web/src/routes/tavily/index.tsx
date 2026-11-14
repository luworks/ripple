import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import { GalleryPitch } from "#/components/GalleryPitch";
import { rooms, tavily } from "#/data/gallery-rooms";

export const Route = createFileRoute("/tavily/")({
	head: () => ({
		meta: [
			{ title: `Tavily in one scroll · ${BRAND}` },
			{
				name: "description",
				content:
					"Tavily is one API that searches, reads and crawls the live web for AI agents. Which verb to use when, and what a credit buys.",
			},
		],
	}),
	component: () => <GalleryPitch pitch={tavily} rooms={rooms} />,
});
