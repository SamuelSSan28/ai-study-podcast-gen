# Environment variables

The application reads environment variables from the process and from a `.env` file
in the project root. It validates them during startup; invalid or missing required
values prevent the application from starting. Values marked **optional** use the
documented default when omitted.

## Application and authentication

| Variable                  | Required | Default | Description                                                                                                    |
| ------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `PORT`                    | No       | `3000`  | Positive integer for the HTTP server port.                                                                     |
| `STUDY_PLAN_CREATE_TOKEN` | Yes      | —       | Shared token required in the `token` query parameter of every API request. Must contain at least 8 characters. |

## OpenAI

| Variable                         | Required | Default           | Description                                                                       |
| -------------------------------- | -------- | ----------------- | --------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                 | Yes      | —                 | API key used to authenticate requests to OpenAI.                                  |
| `OPENAI_CONTENT_MODEL`           | No       | `gpt-5.5`         | Model used for web research and technical content generation.                     |
| `OPENAI_PLANNING_MODEL`          | No       | `gpt-5.5`         | Model used to generate study plans.                                               |
| `OPENAI_VALIDATION_MODEL`        | No       | `gpt-5.5`         | Model used by the podcast-script validation step.                                 |
| `OPENAI_CONVERSATION_PLAN_MODEL` | No       | `gpt-5.5`         | Model used to plan the turns in a conversation.                                   |
| `OPENAI_SCRIPT_MODEL`            | No       | `gpt-5.5`         | Model used to turn session content and a conversation plan into a podcast script. |
| `OPENAI_POLISH_MODEL`            | No       | `gpt-5.5`         | Model used to polish generated dialogue.                                          |
| `OPENAI_TTS_MODEL`               | No       | `gpt-4o-mini-tts` | Text-to-speech model used to synthesize each dialogue turn.                       |

Model names are passed directly to the OpenAI client. Set them to models available
to the account associated with `OPENAI_API_KEY`.

## Notion and notifications

| Variable                | Required | Default | Description                                                                                                                       |
| ----------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `NOTION_API_KEY`        | Yes      | —       | Secret for the Notion integration used to persist plans, topics, and sessions.                                                    |
| `NOTION_PARENT_PAGE_ID` | Yes      | —       | ID of the Notion page under which the application creates or updates its databases. The page must be shared with the integration. |
| `DISCORD_WEBHOOK_URL`   | Yes      | —       | Valid Discord webhook URL used to announce generated episodes.                                                                    |

## Scheduling and podcast generation

| Variable                      | Required | Default             | Description                                                                                       |
| ----------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| `PODCAST_CRON`                | No       | `0 12 * * 2,5`      | Cron expression for automatic generation (by default, noon on Tuesdays and Fridays).              |
| `PODCAST_TIMEZONE`            | No       | `America/Sao_Paulo` | IANA time-zone name applied to `PODCAST_CRON`.                                                    |
| `PODCAST_TARGET_MINUTES`      | No       | `30`                | Target episode duration in whole minutes, from 5 through 60.                                      |
| `DEFAULT_PODCAST_MODE`        | No       | `DISCUSSION`        | Mode used when an API request does not specify one. Accepted values: `INTERVIEW` or `DISCUSSION`. |
| `PODCAST_MAX_TURN_CHARACTERS` | No       | `1200`              | Maximum positive number of characters accepted in one dialogue turn.                              |
| `PODCAST_MIN_TURNS`           | No       | `35`                | Minimum positive number of turns required in a generated script.                                  |
| `PODCAST_MAX_TURNS`           | No       | `120`               | Maximum positive number of turns accepted in a generated script.                                  |

## Voices

Each value is an OpenAI text-to-speech voice name. Interview mode uses the
interviewer and candidate voices; discussion mode uses the host and engineer voices.

| Variable                    | Required | Default | Description                                   |
| --------------------------- | -------- | ------- | --------------------------------------------- |
| `PODCAST_INTERVIEWER_VOICE` | No       | `alloy` | Interviewer's voice in `INTERVIEW` mode.      |
| `PODCAST_CANDIDATE_VOICE`   | No       | `coral` | Candidate's voice in `INTERVIEW` mode.        |
| `PODCAST_HOST_VOICE`        | No       | `alloy` | Host's voice in `DISCUSSION` mode.            |
| `PODCAST_ENGINEER_A_VOICE`  | No       | `alloy` | First engineer's voice in `DISCUSSION` mode.  |
| `PODCAST_ENGINEER_B_VOICE`  | No       | `coral` | Second engineer's voice in `DISCUSSION` mode. |

## Local files and audio

| Variable                | Required | Default              | Description                                                                                                                                |
| ----------------------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `FFMPEG_PATH`           | No       | `ffmpeg`             | Path or executable name used to invoke FFmpeg when composing audio.                                                                        |
| `AUDIO_STORAGE_PATH`    | No       | `./storage/podcasts` | Local directory used for generated audio and temporary turn files.                                                                         |
| `AUDIO_PUBLIC_BASE_URL` | Yes      | —                    | Valid base URL used to construct local audio-streaming URLs, for example `http://localhost:3000/audio`.                                    |

FFmpeg must be installed and reachable through `FFMPEG_PATH`.

## Google Drive

| Variable                      | Required | Default             | Description                                                                                             |
| ----------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------- |
| `GOOGLE_DRIVE_CLIENT_ID`      | Yes      | —                   | OAuth 2.0 client ID used to access Google Drive.                                                        |
| `GOOGLE_DRIVE_CLIENT_SECRET`  | Yes      | —                   | OAuth 2.0 client secret paired with the client ID.                                                      |
| `GOOGLE_DRIVE_REFRESH_TOKEN`  | Yes      | —                   | OAuth 2.0 refresh token used to obtain access tokens without interactive login.                         |
| `GOOGLE_DRIVE_ROOT_FOLDER`    | No       | `AI Study Podcasts` | Name of the Drive folder in which plan and episode folders are created.                                 |
| `GOOGLE_DRIVE_PUBLIC_SHARING` | No       | `true`              | Whether uploaded audio receives public read access. Accepted values are the strings `true` and `false`. |

## Minimal example

The following example supplies every required value and relies on defaults for all
optional settings:

```dotenv
STUDY_PLAN_CREATE_TOKEN=replace-with-a-long-random-token
OPENAI_API_KEY=sk-replace-me
NOTION_API_KEY=secret_replace_me
NOTION_PARENT_PAGE_ID=replace-me
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/replace/me
AUDIO_PUBLIC_BASE_URL=http://localhost:3000/audio
GOOGLE_DRIVE_CLIENT_ID=replace-me.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=replace-me
GOOGLE_DRIVE_REFRESH_TOKEN=replace-me
```

Do not commit real API keys, OAuth credentials, webhook URLs, or the shared API token
to version control.
