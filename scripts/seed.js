require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/db');
const Show = require('../src/models/Show');
const Seat = require('../src/models/Seat');
const User = require('../src/models/User');

const seedData = async () => {
  try {
    console.log('--- Starting Seed Process ---');
    await connectDB();

    // 1. Seed or find Default Test/Demo User
    const demoEmail = 'testuser@example.com';
    let demoUser = await User.findOne({ email: demoEmail });
    if (!demoUser) {
      demoUser = await User.create({
        name: 'Test Viewer',
        email: demoEmail,
        password: 'Password123!'
      });
      console.log(`Created demo user: ${demoEmail}`);
    } else {
      console.log(`Demo user already exists: ${demoEmail}`);
    }

    // 2. Sample Shows Data
    const baseTime = Date.now();
    const sampleShows = [
      {
        movieName: 'Inception (2010)',
        screenName: 'Screen 1 - IMAX',
        startsAt: new Date(baseTime + 2 * 60 * 60 * 1000), // starts in 2 hours
        endsAt: new Date(baseTime + 4.5 * 60 * 60 * 1000), // ends in 4.5 hours
        status: 'SCHEDULED'
      },
      {
        movieName: 'Interstellar (2014)',
        screenName: 'Screen 2 - Dolby Cinema',
        startsAt: new Date(baseTime + 5 * 60 * 60 * 1000), // starts in 5 hours
        endsAt: new Date(baseTime + 8 * 60 * 60 * 1000), // ends in 8 hours
        status: 'SCHEDULED'
      }
    ];

    const rows = ['A', 'B', 'C'];
    const seatsPerRow = 6;

    for (const showData of sampleShows) {
      // Find existing show or create new one to maintain idempotency
      let show = await Show.findOne({
        movieName: showData.movieName,
        screenName: showData.screenName
      });

      if (!show) {
        show = await Show.create(showData);
        console.log(`Created show: ${show.movieName} on ${show.screenName}`);
      } else {
        console.log(`Show already exists: ${show.movieName} on ${show.screenName}`);
      }

      // Check existing seats for this show
      const existingSeatCount = await Seat.countDocuments({ showId: show._id });
      if (existingSeatCount === 0) {
        const seatsToCreate = [];
        for (const row of rows) {
          for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber++) {
            seatsToCreate.push({
              showId: show._id,
              row,
              seatNumber,
              status: 'AVAILABLE',
              holdToken: null,
              holdExpiresAt: null,
              userId: null,
              bookingId: null
            });
          }
        }
        await Seat.insertMany(seatsToCreate);
        console.log(`Seeded ${seatsToCreate.length} seats for show '${show.movieName}'`);
      } else {
        console.log(`Seats already exist for show '${show.movieName}' (${existingSeatCount} seats)`);
      }
    }

    console.log('--- Seeding Completed Successfully ---');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error(`Seeding failed: ${error.message}`);
    await disconnectDB();
    process.exit(1);
  }
};

seedData();

