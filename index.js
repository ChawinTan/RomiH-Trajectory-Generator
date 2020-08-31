
const readline = require('readline');
const fs = require('fs');
const util = require('util');
const { resolve } = require('path');

// RawVelocity received from server is in this format (x, y, theta)
// type RawVelocity = [number, number, number];

// RawPose2D received from server is in this format (x, y, theta)
// type RawPose2D = [number, number, number];

// interface RawKnot {
//   t: number; // milliseconds
//   v: RawVelocity;
//   x: RawPose2D;
// };

const startingTheta = {
  vertical: {
    value: -1.5643726408832297,
    direction: {
      up: 'up',
      down: 'down',
    },
  },
  horizontal: {
    value: -3.1376738367181622,
    direction: {
      left: 'left',
      right: 'right',
    },
  },
};

/***
 * This function is used to generate a random number for
 * various situations stated below:
 *
 * 1) Generating number of waypoints on a straight path per turn
 * 2) Generating a number (0 or 1) to decide turning direction
 * 3) Staring points for x and y
 * 4) Starting configuration
 */
const generateNumber = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max + 1);
  return Math.floor(Math.random() * (max - min) + min);
};

/***
 * This function is used to determine RawVelocity at each turn
 */
const determineVelocity = (theta, direction, velocity) => {
  if (direction === 'up') return [0.0, velocity, theta];
  else if (direction === 'down') return [0.0, -velocity, 0.0];
  else if (direction === 'right') return [velocity, 0.0, theta];
  else return [-velocity, 0.0, 0.0];
};

/** determine the index to retrieve velocity in RawVelocity */
const determineVelocityIndex = (direction) => {
  switch (direction) {
    case 'up':
    case 'down':
      return 1;
    case 'left':
    case 'right':
      return 0;
    default:
      return 2;
  }
};

/**  turning direction, 0 = right and 1 = left */
const determineThetaVelocity = (direction, thetaVelocity) => {
  return direction === 0 ? thetaVelocity : -thetaVelocity;
};

/** Calculate next theta */
const calculateTheta = (currTheta, thetaVelocity) => {
  if (currTheta + thetaVelocity > Math.PI) {
    return -Math.PI + (currTheta + thetaVelocity - Math.PI);
  } else if (currTheta + thetaVelocity < -Math.PI) {
    return Math.PI - (currTheta + thetaVelocity + Math.PI);
  } else {
    return currTheta + thetaVelocity;
  }
};

/**  determine the direction of the straight segment after making a turn */
const determineDirection = (currDir, thetaVelocity) => {
  if (currDir === 'up' && thetaVelocity > 0) return 'right';
  else if (currDir === 'up' && thetaVelocity < 0) return 'left';
  else if (currDir === 'down' && thetaVelocity > 0) return 'right';
  else if (currDir === 'down' && thetaVelocity < 0) return 'left';
  else if (currDir === 'right' && thetaVelocity > 0) return 'up';
  else if (currDir === 'right' && thetaVelocity < 0) return 'down';
  else if (currDir === 'left' && thetaVelocity > 0) return 'up';
  else return 'down';
};

// 5 < startX < 20
// -11 < startY < -7
const createSegments = (
  startX,
  startY,
  startTheta,
  direction,
) => {
  // fix number for now

  // Change the number of turning points
  let turningPoints = 2;
  let startTime = 2000;
  let velocity = 0.5;
  const segment = [];
  const interval = 500;
  const thetaVelocity = 0.25 * Math.PI;

  let currVelocity = determineVelocity(startTheta, direction, velocity);
  let currVelocityIndex = startTheta > -Math.PI * 0.5 ? 1 : 0;
  let currX = startX;
  let currY = startY;
  let currTheta = startTheta;
  let currDirection = direction;

  while (turningPoints > -1) {
    // generate number of waypoints per turn
    const pointsPerStraightSegment = generateNumber(8, 10);

    // generate points for a straight segment
    for (let i = 0; i < pointsPerStraightSegment; i++) {
      segment.push({ t: startTime, v: currVelocity, x: [currX, currY, currTheta] });

      startTime += interval;
      const distance = currVelocity[currVelocityIndex] * (interval / 1000);
      currX = currVelocityIndex === 0 ? (currX += distance) : currX;
      currY = currVelocityIndex === 1 ? (currY += distance) : currY;
    }

    if (turningPoints > 0) {
      // static point before turning
      startTime += interval;
      const turningDirection = generateNumber(0, 1);
      const currThetaVelocity = determineThetaVelocity(turningDirection, thetaVelocity);
      segment.push({
        t: startTime,
        v: [0.0, 0.0, currThetaVelocity],
        x: [currX, currY, currTheta],
      });

      // 2 points needed to turn at a speed of 1/4 Radian per second
      for (let i = 0; i < 2; i++) {
        const thetaHolder = calculateTheta(currTheta, currThetaVelocity);
        currTheta = thetaHolder;
        startTime += 500;
        segment.push({
          t: startTime,
          v: [0.0, 0.0, currThetaVelocity],
          x: [currX, currY, currTheta],
        });
      }

      // last static point after finishing the turn
      startTime += interval;
      segment.push({ t: startTime, v: [0.0, 0.0, 0.0], x: [currX, currY, currTheta] });

      // prep for next straight segment
      currDirection = determineDirection(currDirection, currThetaVelocity);
      currVelocity = determineVelocity(0.0, currDirection, velocity);
      currVelocityIndex = determineVelocityIndex(currDirection);
      startTime += interval;
    }

    turningPoints -= 1;
  }
  return segment;
};

/**
 * Create a bunch of trajectories
 * numberOfTraj must be >= 1
 */
const createTrajectories = (isConflict, numberOfTraj) => {
  const trajHolder = [];
  const conflictHolder = [];
  const conflictingRobotNameHolder = [];

  for (let i = 0; i < numberOfTraj; i++) {
    let knotHolder = [];
    const startX = generateNumber(5, 20);
    const startY = generateNumber(-11, -7);
    const startConfiguration = generateNumber(1, 4);

    switch (startConfiguration) {
      case 1:
        knotHolder = createSegments(
          startX,
          startY,
          startingTheta.horizontal.value,
          startingTheta.horizontal.direction.right,
        );
        break;
      case 2:
        knotHolder = createSegments(
          startX,
          startY,
          startingTheta.horizontal.value,
          startingTheta.horizontal.direction.left,
        );
        break;
      case 3:
        knotHolder = createSegments(
          startX,
          startY,
          startingTheta.vertical.value,
          startingTheta.vertical.direction.up,
        );
        break;
      case 4:
        knotHolder = createSegments(
          startX,
          startY,
          startingTheta.vertical.value,
          startingTheta.vertical.direction.down,
        );
        break;
    }
    trajHolder.push({
      dimensions: 0.3,
      fleet_name: 'tinyRobot',
      id: i,
      robot_name: 'tinyRobot' + i.toString(),
      segments: knotHolder,
      shape: 'circle',
    });

    if (isConflict) {
      conflictHolder.push(i);
      conflictingRobotNameHolder.push('tinyRobot' + i.toString());
    }
  }
  return {
    conflicts: [conflictHolder],
    trajectories: trajHolder,
    conflictingRobotName: [conflictingRobotNameHolder],
  };
};

/**
 * This script is used to generate trajectories and write
 * them into the file, 'utils-default-traj.tsx'
 * 
 * These will be the default trajectories used to display
 * trajectories in storybook.
 */
// 

let isConflict;
let numberOfTraj;
let varName;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const isConflictQuestion = () => {
  return new Promise((resolve, reject) => {
    rl.question('Will trajectories conflict? Please only enter "true" or "false: "', (answer) => {
      isConflict = answer === 'true' ? true : false;
      resolve();
    });
  });
};


const numberOfTrajQuestion = () => {
  return new Promise((resolve, reject) => {
    rl.question('How many trajectories will there be? Enter a number more than 0: ', (answer) => {
      numberOfTraj = parseInt(answer, 10);
      resolve()
    })
  })
}

const varNameQuestion = () => {
  return new Promise((resolve, reject) => {
    rl.question('Enter a variable name to represent trajectory in utils-default-traj.tsx: ', (answer) => {
      varName = answer;
      resolve();
    })
  })
}

const main = async () => {
  await isConflictQuestion();
  await numberOfTrajQuestion();
  await varNameQuestion();

  const trajectoryHolder = createTrajectories(isConflict, numberOfTraj);

  fs.appendFile('utils-default-traj.tsx', `\n export const ${varName} = ` + util.inspect(trajectoryHolder, {showHidden: false, compact: false, depth: null}), (err) => {
    if (err) throw err;
    console.log('file written');
  });
  rl.close();
}

main();
