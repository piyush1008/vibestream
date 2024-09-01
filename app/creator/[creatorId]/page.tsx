"use client";
import StreamView from "@/app/components/StreamView";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function Creator({
    params: {
        creatorId
    }
}: {
    params: {
        creatorId: string;
    }
}) {

    const [playedVideoIds, setPlayedVideoIds] = useState<string[]>([]);
    const searchParams = useSearchParams(); // Use useSearchParams instead of router
    console.log("params", creatorId)

    useEffect(() => {
        // Parse the query parameters from the URL
        const playedParam = searchParams.get("played");
        console.log("1",playedParam?.split(","))

        // Split the IDs into an array if present
        if (playedParam) {
            setPlayedVideoIds(playedParam.split(","));
        }
    }, [searchParams]);
    return <div>
        <StreamView creatorId={creatorId} playVideo={false} playedVideosIds={playedVideoIds} />
    </div>
}