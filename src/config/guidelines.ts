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
        "Please email your slides to {slidesEmail} by {slidesDue}, so our AV team can load and test them in good time.",
        "If they're not quite ready by then, no problem: just bring them on a USB stick and hand them to the AV team in your room when you arrive.",
      ],
    },
    {
      heading: "Keeping to time",
      presentersOnly: false,
      body: [
        "Every speaker deserves their full moment, and so does the audience. In some sessions, a comfort monitor and timer at the front of the stage will show your remaining time.",
        "If a session runs over time, a ringer will sound. That's the cue to wrap up as soon as possible, so the next session can start on time.",
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
