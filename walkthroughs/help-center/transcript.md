# Using Buttons in the Help Center

An animated walkthrough, about two minutes

20 lines, 390 words (about 156 seconds of narration at 150 words per minute).

## Introduction

1. Your customers already check on their tickets in your Help Center. What if they could act on them right there, with one click? `intro-1`
2. With Klick-Zen, you can add buttons to the page where a customer views their ticket, so they can confirm a fix, escalate, or choose a next step. `intro-2`

## Step 1: Copy the snippet

1. Start in Zendesk. Open the Klick-Zen app from the left sidebar, and click Available KlickButtons. `copy-1`
2. Now the important part: turn on the "Help Center Links" toggle. The Zendesk Help Center uses slightly different placeholders than it does for triggers and automations, so the standard snippets won't work there. `copy-2`
3. Find the button you want, and click copy beside its HTML snippet. `copy-3`

## Step 2: Open the theme code

1. Next, click the Zendesk Products icon in the top bar, and select Knowledge. In your help center, click Knowledge admin in the top bar, then click the Customize design icon, the paintbrush. `theme-1`
2. A good habit: duplicate your live theme and edit the copy, so you can preview the button before customers see it. `theme-2`
3. On your copy, click Customize in the corner of the theme preview, then click Edit code. `theme-3`
4. Open request_page.hbs. That's the template for the page where a customer views their own ticket. `theme-4`

## Step 3: Paste the snippet

1. Choose where the button should appear, for example in the ticket details on the right, and paste the snippet in. `paste-1`
2. One button is all that's needed for this example, and you can always paste more beside it to offer a choice. `paste-2`
3. Keep it in request_page.hbs: the Help Center placeholders only fill in on this page. `paste-3`

## Step 4: Preview and publish

1. Preview the theme, and open a ticket as a customer to make sure the button shows up and links correctly. `publish-1`
2. When you're happy, publish the theme. Every customer viewing their own ticket now sees the button, wired to their own request. `publish-2`

## What your customer sees

1. Here's your customer's view: their ticket, the conversation, and one clear way to escalate. `result-1`
2. One click, and they land on a confirmation page. No reply to write, and nothing else to do. `result-2`
3. Back in Zendesk, the ticket is already marked Urgent, and no agent had to lift a finger. `result-3`

## Next steps

1. That's Klick-Zen in your Help Center: one-click actions, right where customers already look. `outro-1`
2. You can also use your own button image, or show buttons only on certain tickets, such as open ones, using your theme's existing logic. `outro-2`
3. Find Klick-Zen on the Zendesk Marketplace, and give your customers a faster way forward. `outro-3`
