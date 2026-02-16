<script lang="ts">
	import { getIsDark, toggleTheme } from '$lib/stores/theme.svelte';

	const isDark = $derived(getIsDark());

	let ripples = $state<{ id: number; x: number; y: number }[]>([]);
	let nextRippleId = 0;
	let buttonEl: HTMLButtonElement | undefined = $state();

	function handleClick(e: MouseEvent) {
		// Spawn ripple at click position relative to button
		if (buttonEl) {
			const rect = buttonEl.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const id = nextRippleId++;
			ripples = [...ripples, { id, x, y }];
			setTimeout(() => {
				ripples = ripples.filter((r) => r.id !== id);
			}, 600);
		}
		toggleTheme();
	}
</script>

<button
	bind:this={buttonEl}
	onclick={handleClick}
	class="theme-toggle group relative ml-auto flex cursor-pointer items-center gap-2 rounded-full px-2 py-1.5 overflow-hidden
		hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors duration-200"
	aria-label="Toggle dark mode"
>
	<!-- Ripple layers -->
	{#each ripples as ripple (ripple.id)}
		<span
			class="ripple-circle"
			style="left: {ripple.x}px; top: {ripple.y}px;"
		></span>
	{/each}

	<!-- Floating particles container -->
	<span class="relative flex items-center gap-1.5">
		<!-- Stars (visible in dark mode, fade/float in) -->
		<span class="stars-container" class:active={isDark}>
			<span class="star star-1">✦</span>
			<span class="star star-2">·</span>
			<span class="star star-3">✦</span>
		</span>

		<!-- Toggle track -->
		<span class="toggle-track {isDark ? 'dark-active' : ''}">
			<!-- Sliding knob with icon -->
			<span class="toggle-knob" class:slid={isDark}>
				<!-- Sun icon -->
				<svg
					class="icon-svg sun-icon"
					class:icon-hidden={isDark}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="4" />
					<line x1="12" y1="2" x2="12" y2="5" />
					<line x1="12" y1="19" x2="12" y2="22" />
					<line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
					<line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
					<line x1="2" y1="12" x2="5" y2="12" />
					<line x1="19" y1="12" x2="22" y2="12" />
					<line x1="4.93" y1="19.07" x2="7.05" y2="16.95" />
					<line x1="16.95" y1="7.05" x2="19.07" y2="4.93" />
				</svg>

				<!-- Moon icon -->
				<svg
					class="icon-svg moon-icon"
					class:icon-hidden={!isDark}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			</span>

			<!-- Track background decor -->
			<span class="track-clouds" class:hidden-decor={isDark}>
				<span class="cloud c1"></span>
				<span class="cloud c2"></span>
			</span>
			<span class="track-stars" class:hidden-decor={!isDark}>
				<span class="mini-star s1"></span>
				<span class="mini-star s2"></span>
				<span class="mini-star s3"></span>
			</span>
		</span>

		<!-- Clouds (visible in light mode, drift in) -->
		<span class="clouds-container" class:active={!isDark}>
			<span class="puff puff-1">☁</span>
			<span class="puff puff-2">☁</span>
		</span>
	</span>
</button>

<style>
	/* ---- Ripple ---- */
	.ripple-circle {
		position: absolute;
		width: 0;
		height: 0;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 70%);
		transform: translate(-50%, -50%);
		animation: ripple-expand 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
		pointer-events: none;
		z-index: 0;
	}

	@keyframes ripple-expand {
		to {
			width: 200px;
			height: 200px;
			opacity: 0;
		}
	}

	/* ---- Toggle Track ---- */
	.toggle-track {
		position: relative;
		display: flex;
		align-items: center;
		width: 44px;
		height: 22px;
		border-radius: 999px;
		background: linear-gradient(135deg, #87ceeb 0%, #60a5fa 100%);
		transition: background 0.5s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
		flex-shrink: 0;
	}

	.toggle-track.dark-active {
		background: linear-gradient(135deg, #1e293b 0%, #312e81 100%);
	}

	/* ---- Knob ---- */
	.toggle-knob {
		position: absolute;
		left: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
		z-index: 2;
	}

	.toggle-knob.slid {
		transform: translateX(22px);
		background: #e2e8f0;
	}

	/* ---- Icons inside knob ---- */
	.icon-svg {
		position: absolute;
		width: 12px;
		height: 12px;
		transition: opacity 0.3s ease, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.sun-icon {
		color: #f59e0b;
		transform: rotate(0deg) scale(1);
	}

	.moon-icon {
		color: #6366f1;
		transform: rotate(0deg) scale(1);
	}

	.icon-hidden {
		opacity: 0;
		transform: rotate(90deg) scale(0.5);
	}

	/* ---- Track decor: Clouds ---- */
	.track-clouds {
		position: absolute;
		inset: 0;
		z-index: 1;
		transition: opacity 0.4s ease;
	}

	.hidden-decor {
		opacity: 0;
		pointer-events: none;
	}

	.cloud {
		position: absolute;
		width: 8px;
		height: 4px;
		background: rgba(255, 255, 255, 0.6);
		border-radius: 999px;
	}

	.c1 {
		top: 5px;
		right: 6px;
		animation: cloud-drift 3s ease-in-out infinite alternate;
	}

	.c2 {
		bottom: 4px;
		right: 12px;
		width: 6px;
		height: 3px;
		animation: cloud-drift 3.5s ease-in-out infinite alternate-reverse;
	}

	@keyframes cloud-drift {
		from { transform: translateX(0); }
		to { transform: translateX(3px); }
	}

	/* ---- Track decor: Stars ---- */
	.track-stars {
		position: absolute;
		inset: 0;
		z-index: 1;
		transition: opacity 0.4s ease;
	}

	.mini-star {
		position: absolute;
		width: 2px;
		height: 2px;
		background: #fbbf24;
		border-radius: 50%;
	}

	.s1 {
		top: 5px;
		left: 8px;
		animation: twinkle 2s ease-in-out infinite;
	}

	.s2 {
		top: 12px;
		left: 14px;
		animation: twinkle 2.5s ease-in-out 0.4s infinite;
	}

	.s3 {
		top: 7px;
		left: 19px;
		width: 1.5px;
		height: 1.5px;
		animation: twinkle 1.8s ease-in-out 0.8s infinite;
	}

	@keyframes twinkle {
		0%, 100% { opacity: 0.3; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.6); }
	}

	/* ---- Floating stars (beside toggle, dark mode) ---- */
	.stars-container {
		display: flex;
		gap: 2px;
		opacity: 0;
		transform: translateY(4px);
		transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
		font-size: 8px;
		color: #fbbf24;
		pointer-events: none;
	}

	.stars-container.active {
		opacity: 1;
		transform: translateY(0);
	}

	.star {
		display: inline-block;
		animation: float-star 2.5s ease-in-out infinite;
	}

	.star-1 { animation-delay: 0s; font-size: 7px; }
	.star-2 { animation-delay: 0.5s; font-size: 10px; }
	.star-3 { animation-delay: 1s; font-size: 6px; }

	@keyframes float-star {
		0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
		50% { transform: translateY(-3px) scale(1.2); opacity: 1; }
	}

	/* ---- Floating clouds (beside toggle, light mode) ---- */
	.clouds-container {
		display: flex;
		gap: 1px;
		opacity: 0;
		transform: translateY(-4px);
		transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
		font-size: 9px;
		color: #94a3b8;
		pointer-events: none;
	}

	.clouds-container.active {
		opacity: 1;
		transform: translateY(0);
	}

	.puff {
		display: inline-block;
		animation: float-puff 3s ease-in-out infinite;
	}

	.puff-1 { animation-delay: 0s; font-size: 8px; }
	.puff-2 { animation-delay: 0.8s; font-size: 6px; }

	@keyframes float-puff {
		0%, 100% { transform: translateY(0) translateX(0); opacity: 0.6; }
		50% { transform: translateY(-2px) translateX(2px); opacity: 1; }
	}

	/* ---- Button hover effect on knob ---- */
	.theme-toggle:hover .toggle-knob {
		box-shadow: 0 1px 6px rgba(99, 102, 241, 0.35);
	}

	/* ---- Reduce motion ---- */
	@media (prefers-reduced-motion: reduce) {
		.toggle-knob,
		.icon-svg,
		.stars-container,
		.clouds-container,
		.ripple-circle {
			transition-duration: 0.01ms !important;
			animation-duration: 0.01ms !important;
		}
	}
</style>
