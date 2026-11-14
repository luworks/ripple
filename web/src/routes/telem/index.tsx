import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "#/brand";
import { GalleryPitch } from "#/components/GalleryPitch";
import { rooms, telem } from "#/data/gallery-rooms";

export const Route = createFileRoute("/telem/")({
	head: () => ({
		meta: [
			{ title: `Telem in one scroll · ${BRAND}` },
			{
				name: "description",
				content:
					"Telem is one API key in front of 11 search engines, 8 page readers and 37 platforms, billed at provider price. What it does and what it costs.",
			},
		],
	}),
	component: () => <GalleryPitch pitch={telem} rooms={rooms} />,
});
