# How do I create a one-click CSAT?

An animated walkthrough, about two minutes

22 lines, 375 words (about 150 seconds of narration at 150 words per minute).

## Introduction

1. Most satisfaction surveys lose people at the click-through: open a link, wait for a page, then fill out a form. `intro-1`
2. With Klick-Zen, the rating buttons sit right in the email, so a single click is the entire survey. `intro-2`

## Step 1: Build the "Great" button

1. Start with a button for happy customers. In Klick-Zen, click Create new button, and name it CSAT Good. `good-1`
2. Type its label right on the button: Great. Then give it a friendly green. `good-2`
3. Now the actions. Click Add button action, choose Add Ticket Tag, and enter csat_good. `good-3`
4. Add a second action, Update Ticket Field, to set a csat_rating custom field to good. Then click Create. `good-4`

## Step 2: Add a "Not so good" button

1. Then build its partner, Not so good. It adds the tag csat_bad, and sets csat_rating to bad. `bad-1`
2. It also sets the ticket status back to Open, so an unhappy customer gets attention straight away. Click Create. `bad-2`

## Pick your scale

1. That's the simple version: two buttons, good or bad. `scales-1`
2. Want more detail? Build five buttons instead, from 1, Very bad, to 5, Great, each with its own rating and tag. `scales-2`

## Step 3: Add them to the solve email

1. Put the buttons in the email that goes out when a ticket is solved. That can be a trigger email, or part of your solve macro. `email-1`
2. Write a short question, then paste the two snippets side by side. `email-2`
3. Save the trigger, and your survey is live. `email-3`

## What your customer sees

1. Your customer gets one simple question, and two buttons. `result-1`
2. One click on Great, and they land on your branded thank-you page. That's the whole survey. `result-2`
3. Back in Zendesk, the rating is already on the ticket, as a tag and a custom field, ready to report on in Zendesk Explore. `result-3`

## Step 4: Close the loop on bad ratings

1. Here's where it gets powerful. Because the rating is a tag, your Zendesk triggers can act on it instantly. `loop-1`
2. When csat_bad is added, a trigger can reopen the ticket, raise the priority to High, alert a team lead, and tell the customer a senior agent is on it. `loop-2`
3. A poor rating stops being a number in a dashboard, and becomes a recovery that starts within seconds. `loop-3`

## Next steps

1. Compared with Zendesk's built-in survey, you choose the wording, the look, the scale, and where it appears. `outro-1`
2. Use it in any trigger, macro, or reply, even where native satisfaction surveys aren't available. `outro-2`
3. Find Klick-Zen on the Zendesk Marketplace, and make your next survey a single click. `outro-3`
