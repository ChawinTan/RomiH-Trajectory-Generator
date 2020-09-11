# Trajectory waypoint generator

This script is used to generate waypoints used to represent a robot trajectory.

### Instructions

1. `cd` into directory
2. On the terminal, type `node index.js`
3. Follow the prompt and answer the questions

You can find the generated trajectory representation inside `utils-default-traj.tsx`.

In order to use the trajectories, you would need to annotate the trajectories with `GeneratedTrajProps` interface for it to work. Below are the instructions and code to generate the interface:

1) Copy the following code

```
import { Conflict, Trajectory } from '../../robot-trajectory-manager';

interface GeneratedTrajProps {
  conflicts: Conflict[];
  trajectories: Trajectory[];
  conflictingRobotName: string[][];
}
```

It imports the necessary types to set up the `GeneratedTrajProps` interface.

2) Annotate the trajectory variable name with the interface.

```
export const defaultTraj: GeneratedTrajProps = {
	// trajectory content
}
```
