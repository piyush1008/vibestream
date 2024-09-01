import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const playedIds = req.nextUrl.searchParams.get("id");

        if (!playedIds) {
            return NextResponse.json({
                message: "Missing id parameter"
            }, {
                status: 411
            });
        }

        // Split the ids if there are multiple
        const playedIdsArray = playedIds.split(',');

        // Fetch the streams from the database
        const streams = await prismaClient.stream.findMany({
            where: {
                id: {
                    in: playedIdsArray
                }
            }
        });

        if (streams.length === 0) {
            return NextResponse.json({
                message: "No songs found"
            });
        }

        return NextResponse.json(streams);
    } catch (error) {
        console.error(error);
        return NextResponse.json({
            message: "Error fetching streams"
        }, {
            status: 500
        });
    }
}

