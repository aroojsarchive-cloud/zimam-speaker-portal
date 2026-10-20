// Speaker guidelines, shown at /guidelines and acknowledged by each speaker.
// Edit the wording here; {slidesDue} is filled in with each presenter's own deadline.

export const SLIDES_DUE_DAYS_BEFORE = 2;

export const guidelines = {
  title: "A few things to help your session go well",
  intro: "Thank you for joining us. These small details make a big difference on the day, for you and for everyone in the room.",
  sections: [
    {
      heading: "Your slides",
      presentersOnly: true,
      body: [
        "Please upload your slides here by {slidesDue}, so our AV team can load and test them in good time.",
        "If they're not quite ready by then, no problem: just bring them on a USB stick and hand them to the AV team in your room when you arrive.",
      ],
    },
    {
      heading: "Keeping to time",
      presentersOnly: false,
      body: [
        "Every speaker deserves their full moment, and so does the audience. To help, a comfort monitor at the front of the stage shows your remaining time.",
        "A bell will sound when there are 5 minutes left, a gentle cue to start bringing your remarks together.",
        "A second bell sounds when your time is up. That's the moment to close and hand the stage to the next speaker.",
      ],
    },
    {
      heading: "Arriving",
      presentersOnly: false,
      body: [
        "Please be in your room 20 minutes before your session and tap “I'm in the room” in this portal, so the team knows you're here.",
      ],
    },
  ],
  button: "I've read the guidelines",
  thanks: "Thank you, we really appreciate your help keeping the day on time.",
} as const;
