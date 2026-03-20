# Component: Ouroboros Runtime (The World)

## Infrastructure Rules
- **Docker Only:** Every core service (LLM, Search, Agent, Dashboard) must be containerized in `docker-compose.yml`.
- **Volume Authority:** Host `../ouroboros_memory` is mapped to container `/memory`. This is the ONLY source of truth for runtime cognitive state. Never store state in `/app`.
- **Watchdog Protocol:** The host-side `watchdog.py` is the final arbiter of health, executing the Phoenix Protocol (Git rollbacks) on failure.

## CLI Usage (`./ouroboros`) & Debugging
- Use `./ouroboros start` to boot the supervised stack in the background.
- Use `./ouroboros stop` to safely tear down the containers and the Watchdog.
- Use `./ouroboros logs -f` to tail the Watchdog logs.
- If the agent container crashes natively, instruct the user to check `/memory/last_crash.log` or run `docker logs ouroboros_agent`.
- Use `./ouroboros reset` to revert the agent to `true-seed`.

## Development Workflow
- When modifying the Docker stack or `entrypoint.sh`, ensure you test the teardown to verify orphaned containers are not left running.
