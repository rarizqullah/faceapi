import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { compareFaceFeatures, FACE_MATCH_THRESHOLD } from '@/utils/faceRecognition';

const prisma = new PrismaClient();
const MINIMUM_CHECKOUT_MINUTES = 5;

export async function POST(req: Request) {
  try {
    const { faceFeatures, timestamp } = await req.json();

    if (!faceFeatures) {
      return NextResponse.json(
        { error: 'Face features are required' },
        { status: 400 }
      );
    }

    // Get all users from the database
    const users = await prisma.user.findMany();
    let matchedUser = null;

    // Compare the uploaded face features with all stored faces
    for (const user of users) {
      const storedFaceFeatures = new Float32Array(JSON.parse(user.faceData));
      const distance = compareFaceFeatures(new Float32Array(faceFeatures), storedFaceFeatures);
      
      if (distance < FACE_MATCH_THRESHOLD) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return NextResponse.json(
        { error: 'Face not recognized. Please register first.' },
        { status: 404 }
      );
    }

    // Get the latest attendance record for the user
    const latestAttendance = await prisma.attendance.findFirst({
      where: { userId: matchedUser.id },
      orderBy: { timestamp: 'desc' }
    });

    const currentTime = new Date(timestamp);

    // Determine if this should be a check-in or check-out
    if (!latestAttendance || latestAttendance.type === 'CHECK_OUT') {
      // If no previous attendance or last was checkout, then this is a check-in
      const attendance = await prisma.attendance.create({
        data: {
          userId: matchedUser.id,
          type: 'CHECK_IN',
          timestamp: currentTime
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Successful attendance',
        user: {
          name: matchedUser.name,
          email: matchedUser.email
        }
      });
    } else {
      // This is a potential check-out
      const timeDifferenceMinutes = (currentTime.getTime() - latestAttendance.timestamp.getTime()) / (1000 * 60);
      
      if (timeDifferenceMinutes < MINIMUM_CHECKOUT_MINUTES) {
        return NextResponse.json({
          error: 'Sorry you have successfully attended',
          minutesLeft: MINIMUM_CHECKOUT_MINUTES - timeDifferenceMinutes
        }, { status: 400 });
      }

      const attendance = await prisma.attendance.create({
        data: {
          userId: matchedUser.id,
          type: 'CHECK_OUT',
          timestamp: currentTime
        }
      });

      return NextResponse.json({
        success: true,
        message: 'You have successfully checked out attendance',
        user: {
          name: matchedUser.name,
          email: matchedUser.email
        }
      });
    }
  } catch (error) {
    console.error('Error processing attendance:', error);
    return NextResponse.json(
      { error: 'Failed to process attendance' },
      { status: 500 }
    );
  }
}