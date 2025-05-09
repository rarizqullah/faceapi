import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { compareFaceFeatures, FACE_MATCH_THRESHOLD } from '@/utils/faceRecognition';

const prisma = new PrismaClient();
const MINIMUM_CHECKOUT_MINUTES = 5;

export async function POST(req: Request) {
  try {
    const { faceFeatures, timestamp, metrics } = await req.json();

    if (!faceFeatures || !Array.isArray(faceFeatures)) {
      return NextResponse.json(
        { error: 'Valid face features are required' },
        { status: 400 }
      );
    }

    console.log('Processing attendance with face features length:', faceFeatures.length);

    // Get all users from the database
    const users = await prisma.user.findMany();
    let matchedUser = null;
    let bestMatchSimilarity = 0;

    // Compare the uploaded face features with all stored faces
    const uploadedFaceFeatures = new Float32Array(faceFeatures);

    for (const user of users) {
      try {
        const storedFaceFeatures = new Float32Array(JSON.parse(user.faceData));
        if (storedFaceFeatures.length !== uploadedFaceFeatures.length) {
          console.error(`Invalid face data length for user ${user.id}`);
          continue;
        }

        const similarity = compareFaceFeatures(uploadedFaceFeatures, storedFaceFeatures);
        console.log(`Comparing with user ${user.name}, similarity: ${similarity}`);
        
        if (similarity >= (1 - FACE_MATCH_THRESHOLD) && similarity > bestMatchSimilarity) {
          matchedUser = user;
          bestMatchSimilarity = similarity;
        }
      } catch (error) {
        console.error(`Error comparing faces for user ${user.id}:`, error);
        continue;
      }
    }

    if (!matchedUser) {
      console.log('No matching user found. Best similarity:', bestMatchSimilarity);
      return NextResponse.json(
        { error: 'Face not recognized. Please register first.' },
        { status: 404 }
      );
    }

    console.log('Found matching user:', matchedUser.name, 'with similarity:', bestMatchSimilarity);

    // Get the latest attendance record for the user
    const latestAttendance = await prisma.attendance.findFirst({
      where: { userId: matchedUser.id },
      orderBy: { timestamp: 'desc' }
    });

    const currentTime = new Date(timestamp);

    // Calculate overall accuracy using both metrics and face similarity
    const overallAccuracy = metrics ? 
      (metrics.accuracy * bestMatchSimilarity) : bestMatchSimilarity;

    // Determine if this should be a check-in or check-out
    if (!latestAttendance || latestAttendance.type === 'CHECK_OUT') {
      // This is a check-in
      const attendance = await prisma.attendance.create({
        data: {
          userId: matchedUser.id,
          type: 'CHECK_IN',
          timestamp: currentTime,
          accuracy: overallAccuracy,
          latencyMs: metrics?.latencyMs || 0
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Successful attendance check-in',
        user: {
          name: matchedUser.name,
          email: matchedUser.email
        },
        metrics: {
          accuracy: overallAccuracy,
          latencyMs: metrics?.latencyMs || 0,
          similarity: bestMatchSimilarity
        }
      });
    } else {
      // This is a potential check-out
      const timeDifferenceMinutes = 
        (currentTime.getTime() - latestAttendance.timestamp.getTime()) / (1000 * 60);
      
      if (timeDifferenceMinutes < MINIMUM_CHECKOUT_MINUTES) {
        return NextResponse.json({
          error: 'You have already checked in recently',
          minutesLeft: MINIMUM_CHECKOUT_MINUTES - timeDifferenceMinutes
        }, { status: 400 });
      }

      const attendance = await prisma.attendance.create({
        data: {
          userId: matchedUser.id,
          type: 'CHECK_OUT',
          timestamp: currentTime,
          accuracy: overallAccuracy,
          latencyMs: metrics?.latencyMs || 0
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Successful attendance check-out',
        user: {
          name: matchedUser.name,
          email: matchedUser.email
        },
        metrics: {
          accuracy: overallAccuracy,
          latencyMs: metrics?.latencyMs || 0,
          similarity: bestMatchSimilarity
        }
      });
    }
  } catch (error) {
    console.error('Error processing attendance:', error);
    return NextResponse.json(
      { error: 'Failed to process attendance' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}