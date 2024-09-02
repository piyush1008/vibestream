import { prismaClient } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
//@ts-ignore
import youtubesearchapi from "youtube-search-api";
import { YT_REGEX } from "@/app/lib/utils";
import { getServerSession } from "next-auth";
//@ts-ignore
import youtube from "youtube-api"

const CreateStreamSchema = z.object({
    creatorId: z.string(),
    url: z.string()
});

const MAX_QUEUE_LEN = 20;

interface Thumbnail {
    url: string;
    width: number;
    height: number;
}

interface VideoDetails {
    title: string;
    thumbnails: {
        [key: string]: Thumbnail;
    };
}


youtube.authenticate({
    type: 'key',
    key: process.env.YOUTUBE_API_KEY, // Replace with your API key
  });

// function getVideoThumbnails(videoId:any) {
//     youtube.videos.list({
//       part: 'snippet',
//       id: videoId,
//     }, (err:any, data:any) => {
//       if (err) {
//         console.error('Error fetching video details:', err);
//         return;
//       }
//       console.log(data)
//       console.log(data.data.items[0].snippet.title);
//       console.log(data.data.items[0].snippet.thumbnails);
//       return {
//         title:data.data.items[0].snippet.title,
//         thumbnails:data.data.items[0].snippet.thumbnails
//       }
//     });
//   }

  function getVideoThumbnails(videoId:any):Promise<VideoDetails> {
    return new Promise((resolve, reject) => {
        youtube.videos.list({
            part: 'snippet',
            id: videoId,
        }, (err:any, data:any) => {
            if (err) {
                console.error('Error fetching video details:', err);
                reject(err);
                return;
            }

            if (data.data.items.length === 0) {
                console.log('No video found with the provided ID.');
                reject(new Error('No video found'));
                return;
            }

            // const video = data.data.items[0].snippet.title;
            const title = data.data.items[0].snippet.title;
            const thumbnails = data.data.items[0].snippet.thumbnails;

            resolve({
                title,
                thumbnails
            });
        });
    });
}


export async function POST(req: NextRequest) {
    try {
        const data = CreateStreamSchema.parse(await req.json());
        const isYt = data.url.match(YT_REGEX)
        if (!isYt) {
            return NextResponse.json({
                message: "Wrong URL format"
            }, {
                status: 411
            })    
        }

        console.log("inside the create stream");

        const extractedId = data.url.split("?v=")[1];
        console.log("extracted", extractedId)

        console.log(process.env.YOUTUBE_API_KEY)

        const res = await youtubesearchapi.GetVideoDetails(extractedId);
        console.log("res", res);

        
       const response=await getVideoThumbnails(extractedId); 
        console.log("response from the new api",response.title)
        console.log("response thumnails",response.thumbnails)
        console.log("small img url",response.thumbnails.default.url);
        console.log("large img url",response.thumbnails.high.url);


        console.log("inside the create Stream" , res);
        // let thumbnails;
        // if(res.thumbnail){
        //      thumbnails = res.thumbnail.thumbnails;
        //     thumbnails.sort((a: {width: number}, b: {width: number}) => a.width < b.width ? -1 : 1);
        // }
        

        const existingActiveStream = await prismaClient.stream.count({
            where: {
                userId: data.creatorId
            }
        })

        console.log("inside the create Stream -2");


        if (existingActiveStream > MAX_QUEUE_LEN) {
            return NextResponse.json({
                message: "Already at limit"
            }, {
                status: 411
            })
        }


        console.log("inside the create Stream -3");


        const stream = await prismaClient.stream.create({
            data: {
                userId: data.creatorId,
                url: data.url,
                extractedId,
                type: "Youtube",
                title: response.title ?? "Cant find video",
                smallImg: response.thumbnails.medium.url ?? "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg",
                bigImg: response.thumbnails.high.url ?? "https://cdn.pixabay.com/photo/2024/02/28/07/42/european-shorthair-8601492_640.jpg"
            }
        });
        console.log("streams", stream)
        return NextResponse.json({
            ...stream,
            hasUpvoted: false,
            upvotes: 0
        })
    } catch(e) {
        console.log(e);
        return NextResponse.json({
            message: "Error while adding a stream"
        }, {
            status: 411
        })
    }

}

export async function GET(req: NextRequest) {
    try {
        
   
    const creatorId = req.nextUrl.searchParams.get("creatorId");

    console.log("creatorID inside", creatorId)
    const session = await getServerSession();
    console.log(session)
     // TODO: You can get rid of the db call here 
     const user = await prismaClient.user.findFirst({
        where: {
            email: session?.user?.email ?? ""
        }
    });

    if (!user) {
        return NextResponse.json({
            message: "Unauthenticated"
        }, {
            status: 403
        })
    }

    if (!creatorId) {
        return NextResponse.json({
            message: "Error"
        }, {
            status: 411
        })
    }

    const [streams, activeStream] = await Promise.all([await prismaClient.stream.findMany({
        where: {
            userId: creatorId,
            played: false
        },
        include: {
            _count: {
                select: {
                    upvotes: true
                }
            },
            upvotes: {
                where: {
                    userId: user.id
                }
            }
        }
    }), prismaClient.currentStream.findFirst({
        where: {
            userId: creatorId
        },
        include: {
            stream: true
        }
    })])

    return NextResponse.json({
        streams: streams.map(({_count, ...rest}) => ({
            ...rest,
            upvotes: _count.upvotes,
            haveUpvoted: rest.upvotes.length ? true : false
        })),
        activeStream
    })
    } catch (error) {
         console.log(error);
         return NextResponse.json({
            message: "Error"
        }, {
            status: 500
        })
    }
}
 