const deadline = Date.parse(process.env.STUDIO_HARD_DEADLINE ?? '')
if (!Number.isFinite(deadline)) throw new Error('STUDIO_HARD_DEADLINE is required.')

const maximumDelay = 30_000
while (Date.now() < deadline) {
  await new Promise((resolvePromise) =>
    setTimeout(resolvePromise, Math.min(maximumDelay, Math.max(250, deadline - Date.now())))
  )
}

process.exit(70)
