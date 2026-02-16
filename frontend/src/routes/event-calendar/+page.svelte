<script lang="ts">
	import { goto } from '$app/navigation';
	import { getIsDark } from '$lib/stores/theme.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import type { PayloadCalendarEvent } from '$lib/types/payload';

	let { data } = $props();

	const isDark = $derived(getIsDark());

	let events = $state<PayloadCalendarEvent[]>(data.events);
	let currentMonth = $state(data.month);
	let currentYear = $state(data.year);

	$effect(() => {
		events = data.events;
		currentMonth = data.month;
		currentYear = data.year;
	});

	const MONTH_NAMES = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

	let monthDirection = $state<'left' | 'right' | null>(null);
	let gridKey = $state(0);

	const calendarDays = $derived.by(() => {
		const firstDay = new Date(currentYear, currentMonth, 1).getDay();
		const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
		const days: (number | null)[] = [];
		for (let i = 0; i < firstDay; i++) days.push(null);
		for (let d = 1; d <= daysInMonth; d++) days.push(d);
		return days;
	});

	function dateStr(day: number): string {
		return `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	}

	function eventsForDay(day: number): PayloadCalendarEvent[] {
		const ds = dateStr(day);
		return events.filter((ev) => {
			const start = ev.start_date.slice(0, 10);
			const end = ev.end_date.slice(0, 10);
			return ds >= start && ds <= end;
		});
	}

	function isToday(day: number): boolean {
		return dateStr(day) === todayStr;
	}

	function prevMonth() {
		monthDirection = 'right';
		gridKey++;
		let m = currentMonth - 1;
		let y = currentYear;
		if (m < 0) { m = 11; y--; }
		selectedDay = null;
		goto(`/event-calendar?month=${m}&year=${y}`);
	}

	function nextMonth() {
		monthDirection = 'left';
		gridKey++;
		let m = currentMonth + 1;
		let y = currentYear;
		if (m > 11) { m = 0; y++; }
		selectedDay = null;
		goto(`/event-calendar?month=${m}&year=${y}`);
	}

	function goToToday() {
		monthDirection = 'left';
		gridKey++;
		selectedDay = null;
		goto(`/event-calendar?month=${today.getMonth()}&year=${today.getFullYear()}`);
	}

	let selectedDay = $state<number | null>(null);
	const selectedEvents = $derived(selectedDay !== null ? eventsForDay(selectedDay) : []);

	function selectDay(day: number) {
		selectedDay = selectedDay === day ? null : day;
	}

	let showAddModal = $state(false);
	let addTitle = $state('');
	let addDescription = $state('');
	let addStartDate = $state('');
	let addEndDate = $state('');
	let submitting = $state(false);
	let addError = $state('');

	function openAddModal() {
		if (selectedDay !== null) {
			const ds = dateStr(selectedDay);
			addStartDate = ds;
			addEndDate = ds;
		}
		addTitle = '';
		addDescription = '';
		addError = '';
		showAddModal = true;
	}

	async function addEvent() {
		if (!addTitle.trim() || !addStartDate || !addEndDate) {
			addError = 'Title and dates are required.';
			return;
		}
		if (addEndDate < addStartDate) {
			addError = 'End date cannot be before start date.';
			return;
		}

		submitting = true;
		addError = '';
		try {
			const res = await fetch('/api/calendar-events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: addTitle.trim(),
					description: addDescription.trim() || null,
					start_date: addStartDate,
					end_date: addEndDate,
				}),
			});
			if (res.ok) {
				showAddModal = false;
				await refreshEvents();
			} else {
				addError = 'Failed to add event. Please try again.';
			}
		} catch {
			addError = 'Network error. Please try again.';
		} finally {
			submitting = false;
		}
	}

	let deletingId = $state<number | null>(null);

	async function deleteEvent(id: number) {
		deletingId = id;
		try {
			const res = await fetch(`/api/calendar-events/${id}`, { method: 'DELETE' });
			if (res.ok) {
				await refreshEvents();
			}
		} catch {
			// ignore
		} finally {
			deletingId = null;
		}
	}

	async function refreshEvents() {
		try {
			const lastDay = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
			const startOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
			const endOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
			const params = new URLSearchParams({
				'where[start_date][less_than_equal]': endOfMonth,
				'where[end_date][greater_than_equal]': startOfMonth,
				limit: '100',
				sort: 'start_date',
			});
			const res = await fetch(`/api/calendar-events?${params}`);
			if (res.ok) {
				const json = await res.json();
				events = json.docs;
			}
		} catch {
			// ignore
		}
	}

	let mouseX = $state(0);
	let mouseY = $state(0);

	function handleMouseMove(e: MouseEvent) {
		mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
		mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
	}
</script>

<svelte:head>
	<title>Event Calendar - Veent</title>
</svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="cal-page min-h-screen bg-gray-50 dark:bg-[#0a0e1a]" class:dark={isDark} onmousemove={handleMouseMove}>
	<!-- ═══════════════════════════════════════════════════════════
	     HERO SECTION
	     ═══════════════════════════════════════════════════════════ -->
	<section class="relative overflow-hidden py-28 sm:py-36">
		<!-- Background -->
		<div class="absolute inset-0">
			<div class="absolute inset-0 bg-gradient-to-br from-slate-100 via-indigo-50/50 to-purple-50/30 dark:from-[#0a0e1a] dark:via-[#111836] dark:to-[#0a0e1a]"></div>
			<!-- Grid overlay -->
			<div class="grid-overlay absolute inset-0"></div>
		</div>

		<!-- Parallax orbs -->
		<div
			class="orb orb-1 absolute h-[500px] w-[500px] rounded-full"
			style="top: -10%; left: -5%; transform: translate({mouseX * 30}px, {mouseY * 20}px);"
		></div>
		<div
			class="orb orb-2 absolute h-[400px] w-[400px] rounded-full"
			style="bottom: -15%; right: -8%; transform: translate({mouseX * -25}px, {mouseY * -15}px);"
		></div>
		<div
			class="orb orb-3 absolute h-[250px] w-[250px] rounded-full"
			style="top: 20%; right: 15%; transform: translate({mouseX * 15}px, {mouseY * -25}px);"
		></div>
		<div
			class="orb orb-4 absolute h-[180px] w-[180px] rounded-full"
			style="bottom: 25%; left: 10%; transform: translate({mouseX * -20}px, {mouseY * 10}px);"
		></div>

		<!-- Floating particles -->
		<div class="particle particle-1"></div>
		<div class="particle particle-2"></div>
		<div class="particle particle-3"></div>
		<div class="particle particle-4"></div>
		<div class="particle particle-5"></div>
		<div class="particle particle-6"></div>

		<!-- Hero content -->
		<div class="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="mx-auto max-w-3xl text-center">
				<div class="hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/60 px-4 py-1.5 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
					<span class="relative flex h-2 w-2">
						<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
					</span>
					<span class="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Schedule</span>
				</div>
				<h1 class="hero-title text-5xl font-black tracking-tight text-gray-900 dark:text-white sm:text-7xl">
					Event
					<span class="relative">
						<span class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">Calendar</span>
						<span class="absolute -bottom-2 left-0 h-1 w-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60 blur-sm"></span>
					</span>
				</h1>
				<p class="hero-subtitle mt-8 text-lg leading-relaxed text-gray-500 dark:text-gray-400 sm:text-xl">
					Mark busy days, track schedules, and plan ahead — all in one beautiful view.
				</p>
			</div>
		</div>
	</section>

	<!-- ═══════════════════════════════════════════════════════════
	     CALENDAR SECTION
	     ═══════════════════════════════════════════════════════════ -->
	<section class="relative pb-24">
		<!-- Background glow -->
		<div class="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-200/20 blur-[120px] dark:bg-indigo-600/5"></div>

		<div class="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
			<!-- Month Navigation -->
			<div class="glass-card mb-8 flex items-center justify-between rounded-2xl px-4 py-4 sm:px-8">
				<button
					onclick={prevMonth}
					class="nav-btn group flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200/60 bg-white/60 px-4 py-2.5 text-sm font-medium text-gray-600 backdrop-blur-sm transition-all duration-300 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 hover:shadow-lg hover:shadow-indigo-500/5 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-white dark:hover:shadow-indigo-500/10"
				>
					<svg class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
					<span class="hidden sm:inline">Prev</span>
				</button>

				<div class="flex items-center gap-3 sm:gap-4">
					<h2 class="month-title text-xl font-bold text-gray-900 dark:text-white sm:text-3xl">
						{MONTH_NAMES[currentMonth]}
						<span class="text-indigo-500 dark:text-indigo-400">{currentYear}</span>
					</h2>
					<button
						onclick={goToToday}
						class="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 transition-all duration-300 hover:border-indigo-300 hover:bg-indigo-100 hover:shadow-md hover:shadow-indigo-500/5 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300 dark:hover:shadow-indigo-500/10"
					>
						Today
					</button>
				</div>

				<div class="flex items-center gap-2">
					<ThemeToggle />
					<button
						onclick={nextMonth}
						class="nav-btn group flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200/60 bg-white/60 px-4 py-2.5 text-sm font-medium text-gray-600 backdrop-blur-sm transition-all duration-300 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700 hover:shadow-lg hover:shadow-indigo-500/5 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-white dark:hover:shadow-indigo-500/10"
					>
						<span class="hidden sm:inline">Next</span>
						<svg class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Calendar Grid -->
			<div class="glass-card overflow-hidden rounded-3xl">
				<!-- Day Headers -->
				<div class="grid grid-cols-7 border-b border-gray-200/60 bg-gray-50/50 dark:border-white/5 dark:bg-white/[0.02]">
					{#each DAY_NAMES as dayName, i}
						<div
							class="day-header py-4 text-center text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-500"
							style="animation-delay: {i * 50}ms"
						>
							{dayName}
						</div>
					{/each}
				</div>

				<!-- Grid Cells -->
				{#key gridKey}
					<div class="calendar-grid grid grid-cols-7" class:slide-in-left={monthDirection === 'left'} class:slide-in-right={monthDirection === 'right'}>
						{#each calendarDays as day, i}
							{#if day === null}
								<div class="empty-cell border-b border-r border-gray-200/60 bg-gray-50/50 p-1 dark:border-white/[0.04] dark:bg-white/[0.01] sm:p-2" style="min-height: 90px;"></div>
							{:else}
								{@const dayEvents = eventsForDay(day)}
								{@const isBusy = dayEvents.length > 0}
								{@const isSelected = selectedDay === day}
								{@const todayCheck = isToday(day)}
								<button
									onclick={() => selectDay(day)}
									class="day-cell group relative cursor-pointer border-b border-r border-gray-200/60 p-1 text-left transition-all duration-300 dark:border-white/[0.04] sm:p-2
										{isBusy ? 'busy-cell' : ''}
										{isSelected ? 'selected-cell' : ''}
										{todayCheck ? 'today-cell' : ''}"
									style="min-height: 90px; animation-delay: {(i % 7) * 30 + Math.floor(i / 7) * 40}ms;"
								>
									<!-- Hover glow -->
									<div class="absolute inset-0 rounded-sm bg-gradient-to-br from-indigo-500/0 via-purple-500/0 to-pink-500/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:from-indigo-100/50 group-hover:via-purple-50/30 group-hover:to-pink-50/20 dark:group-hover:from-indigo-500/5 dark:group-hover:via-purple-500/5 dark:group-hover:to-pink-500/5"></div>

									<!-- Selected highlight -->
									{#if isSelected}
										<div class="absolute inset-0 rounded-sm ring-2 ring-inset ring-indigo-400/50 dark:ring-indigo-500/50 transition-all duration-300"></div>
										<div class="absolute inset-0 rounded-sm bg-indigo-50/60 dark:bg-indigo-500/[0.08]"></div>
									{/if}

									<!-- Content -->
									<div class="relative z-10">
										<div class="flex items-start justify-between">
											<span
												class="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300
													{todayCheck
														? 'today-badge bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/40'
														: isSelected
															? 'text-indigo-600 dark:text-indigo-300'
															: 'text-gray-700 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white'}"
											>
												{day}
											</span>
											{#if isBusy}
												<span class="busy-dot relative flex h-2.5 w-2.5">
													<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-50"></span>
													<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 shadow-md shadow-rose-500/40"></span>
												</span>
											{/if}
										</div>
										{#if dayEvents.length > 0}
											<div class="mt-1.5 space-y-1">
												{#each dayEvents.slice(0, 2) as ev}
													<div class="event-pill truncate rounded-md border border-rose-200/60 bg-gradient-to-r from-rose-50 to-pink-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:border-rose-500/20 dark:from-rose-500/15 dark:to-pink-500/10 dark:text-rose-300 sm:text-xs">
														{ev.title}
													</div>
												{/each}
												{#if dayEvents.length > 2}
													<div class="text-[10px] text-gray-500 dark:text-gray-600">+{dayEvents.length - 2} more</div>
												{/if}
											</div>
										{/if}
									</div>
								</button>
							{/if}
						{/each}
					</div>
				{/key}
			</div>

			<!-- ═══════════════════════════════════════════════════════════
			     SELECTED DAY DETAIL PANEL
			     ═══════════════════════════════════════════════════════════ -->
			{#if selectedDay !== null}
				<div class="detail-panel mt-8">
					<div class="glass-card overflow-hidden rounded-3xl">
						<div class="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

						<div class="p-6 sm:p-8">
							<div class="mb-6 flex items-center justify-between">
								<div>
									<p class="mb-1 text-xs font-medium uppercase tracking-wider text-indigo-500 dark:text-indigo-400">Selected Date</p>
									<h3 class="text-2xl font-bold text-gray-900 dark:text-white">
										{MONTH_NAMES[currentMonth]} {selectedDay}, {currentYear}
									</h3>
								</div>
								<button
									onclick={openAddModal}
									class="add-busy-btn group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/30 hover:brightness-110 dark:border-indigo-500/30"
								>
									<svg class="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
									</svg>
									Add Busy
								</button>
							</div>

							{#if selectedEvents.length > 0}
								<div class="space-y-3">
									{#each selectedEvents as ev, i}
										<div
											class="event-card group/card flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50/50 p-5 transition-all duration-300 hover:border-gray-300 hover:bg-gray-100/50 dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.06]"
											style="animation-delay: {i * 80}ms"
										>
											<div class="min-w-0 flex-1">
												<div class="flex items-center gap-3">
													<div class="h-8 w-1 rounded-full bg-gradient-to-b from-rose-400 to-pink-600"></div>
													<div>
														<h4 class="font-semibold text-gray-900 dark:text-white">{ev.title}</h4>
														{#if ev.description}
															<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{ev.description}</p>
														{/if}
														<p class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 dark:border-white/5 dark:bg-white/5 dark:text-gray-500">
															<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
																<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
															</svg>
															{#if ev.start_date.slice(0, 10) === ev.end_date.slice(0, 10)}
																{ev.start_date.slice(0, 10)}
															{:else}
																{ev.start_date.slice(0, 10)} &rarr; {ev.end_date.slice(0, 10)}
															{/if}
														</p>
													</div>
												</div>
											</div>
											<button
												onclick={() => deleteEvent(ev.id)}
												disabled={deletingId === ev.id}
												class="delete-btn cursor-pointer rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition-all duration-300 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500 hover:shadow-lg hover:shadow-rose-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/5 dark:bg-white/[0.03] dark:text-gray-500 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 dark:hover:shadow-rose-500/10"
												aria-label="Delete event"
											>
												{#if deletingId === ev.id}
													<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
														<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
														<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
													</svg>
												{:else}
													<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												{/if}
											</button>
										</div>
									{/each}
								</div>
							{:else}
								<div class="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 py-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
									<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/[0.03]">
										<svg class="h-8 w-8 text-gray-400 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
											<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
									</div>
									<p class="text-sm text-gray-500 dark:text-gray-500">No events on this day.</p>
									<p class="mt-1 text-xs text-gray-400 dark:text-gray-600">Click "Add Busy" to mark it.</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</section>
</div>

<!-- ═══════════════════════════════════════════════════════════
     ADD EVENT MODAL
     ═══════════════════════════════════════════════════════════ -->
{#if showAddModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop fixed inset-0 z-[9998] flex items-center justify-center"
		class:dark={isDark}
		onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }}
		onkeydown={(e) => { if (e.key === 'Escape') showAddModal = false; }}
	>
		<div class="modal-content mx-4 w-full max-w-lg">
			<div class="modal-card relative overflow-hidden rounded-3xl border border-gray-200/60 bg-white/90 shadow-2xl shadow-gray-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-[#111836]/90 dark:shadow-black/50">
				<!-- Decorative glow -->
				<div class="absolute -top-20 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-indigo-200/30 blur-[80px] dark:bg-indigo-500/20"></div>

				<div class="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

				<div class="relative p-8">
					<div class="mb-6 flex items-center justify-between">
						<div>
							<h3 class="text-xl font-bold text-gray-900 dark:text-white">Add Busy Day</h3>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-500">Mark a day or range as busy</p>
						</div>
						<button
							onclick={() => (showAddModal = false)}
							class="cursor-pointer rounded-xl border border-gray-200 bg-gray-100 p-2 text-gray-500 transition-all duration-300 hover:border-gray-300 hover:bg-gray-200 hover:text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white"
							aria-label="Close"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form onsubmit={(e) => { e.preventDefault(); addEvent(); }} class="space-y-5">
						{#if addError}
							<div class="error-shake rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
								{addError}
							</div>
						{/if}

						<div class="form-field">
							<label for="cal-title" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
							<input
								id="cal-title"
								type="text"
								bind:value={addTitle}
								required
								class="glass-input w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-600 dark:focus:border-indigo-500/50 dark:focus:bg-white/[0.08] dark:focus:shadow-indigo-500/10"
								placeholder="e.g. Team meeting"
							/>
						</div>

						<div class="form-field" style="animation-delay: 50ms">
							<label for="cal-desc" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Description <span class="text-gray-400 dark:text-gray-600">(optional)</span></label>
							<textarea
								id="cal-desc"
								bind:value={addDescription}
								rows="3"
								class="glass-input w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-gray-600 dark:focus:border-indigo-500/50 dark:focus:bg-white/[0.08] dark:focus:shadow-indigo-500/10"
								placeholder="Add details..."
							></textarea>
						</div>

						<div class="form-field grid grid-cols-2 gap-4" style="animation-delay: 100ms">
							<div>
								<label for="cal-start" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</label>
								<input
									id="cal-start"
									type="date"
									bind:value={addStartDate}
									required
									class="glass-input w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-indigo-500/50 dark:focus:bg-white/[0.08] dark:focus:shadow-indigo-500/10"
								/>
							</div>
							<div>
								<label for="cal-end" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
								<input
									id="cal-end"
									type="date"
									bind:value={addEndDate}
									required
									class="glass-input w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 transition-all duration-300 focus:border-indigo-400 focus:bg-white focus:shadow-lg focus:shadow-indigo-500/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-indigo-500/50 dark:focus:bg-white/[0.08] dark:focus:shadow-indigo-500/10"
								/>
							</div>
						</div>

						<div class="flex justify-end gap-3 pt-3">
							<button
								type="button"
								onclick={() => (showAddModal = false)}
								class="cursor-pointer rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition-all duration-300 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={submitting}
								class="submit-btn group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if submitting}
									<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Adding...
								{:else}
									Add Event
									<svg class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
									</svg>
								{/if}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ═══════════════════════════════════════════════════════════
	   GLASS MORPHISM — Light + Dark
	   ═══════════════════════════════════════════════════════════ */
	.glass-card {
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.4) 100%);
		border: 1px solid rgba(0, 0, 0, 0.08);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.06),
			inset 0 1px 0 rgba(255, 255, 255, 0.8);
	}

	:global(.dark) .glass-card {
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
		border: 1px solid rgba(255, 255, 255, 0.06);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	/* ═══════════════════════════════════════════════════════════
	   GRID OVERLAY — Light + Dark
	   ═══════════════════════════════════════════════════════════ */
	.grid-overlay {
		opacity: 0.04;
		background-image:
			linear-gradient(rgba(99, 102, 241, 0.15) 1px, transparent 1px),
			linear-gradient(90deg, rgba(99, 102, 241, 0.15) 1px, transparent 1px);
		background-size: 60px 60px;
	}

	:global(.dark) .grid-overlay {
		opacity: 0.03;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
	}

	/* ═══════════════════════════════════════════════════════════
	   FLOATING ORBS — Light + Dark
	   ═══════════════════════════════════════════════════════════ */
	.orb {
		filter: blur(80px);
		will-change: transform;
		transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}
	.orb-1 {
		background: radial-gradient(circle, rgba(99, 102, 241, 0.12), transparent 70%);
		animation: orbFloat1 20s ease-in-out infinite;
	}
	.orb-2 {
		background: radial-gradient(circle, rgba(168, 85, 247, 0.1), transparent 70%);
		animation: orbFloat2 25s ease-in-out infinite;
	}
	.orb-3 {
		background: radial-gradient(circle, rgba(236, 72, 153, 0.08), transparent 70%);
		animation: orbFloat3 18s ease-in-out infinite;
	}
	.orb-4 {
		background: radial-gradient(circle, rgba(59, 130, 246, 0.08), transparent 70%);
		animation: orbFloat4 22s ease-in-out infinite;
	}

	:global(.dark) .orb-1 { background: radial-gradient(circle, rgba(99, 102, 241, 0.15), transparent 70%); }
	:global(.dark) .orb-2 { background: radial-gradient(circle, rgba(168, 85, 247, 0.12), transparent 70%); }
	:global(.dark) .orb-3 { background: radial-gradient(circle, rgba(236, 72, 153, 0.1), transparent 70%); }
	:global(.dark) .orb-4 { background: radial-gradient(circle, rgba(59, 130, 246, 0.1), transparent 70%); }

	@keyframes orbFloat1 {
		0%, 100% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(30px, -40px) scale(1.05); }
		66% { transform: translate(-20px, 20px) scale(0.95); }
	}
	@keyframes orbFloat2 {
		0%, 100% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(-40px, 30px) scale(1.08); }
		66% { transform: translate(25px, -25px) scale(0.92); }
	}
	@keyframes orbFloat3 {
		0%, 100% { transform: translate(0, 0); }
		50% { transform: translate(35px, 25px); }
	}
	@keyframes orbFloat4 {
		0%, 100% { transform: translate(0, 0); }
		50% { transform: translate(-30px, -35px); }
	}

	/* ═══════════════════════════════════════════════════════════
	   FLOATING PARTICLES — Light + Dark
	   ═══════════════════════════════════════════════════════════ */
	.particle {
		position: absolute;
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: rgba(99, 102, 241, 0.3);
		pointer-events: none;
	}

	:global(.dark) .particle { background: rgba(99, 102, 241, 0.5); }

	.particle-1 {
		top: 15%; left: 20%;
		animation: particleFloat 12s ease-in-out infinite;
		box-shadow: 0 0 6px rgba(99, 102, 241, 0.2);
	}
	.particle-2 {
		top: 40%; left: 75%;
		animation: particleFloat 16s ease-in-out infinite reverse;
		background: rgba(168, 85, 247, 0.3);
		box-shadow: 0 0 6px rgba(168, 85, 247, 0.2);
		width: 2px; height: 2px;
	}
	.particle-3 {
		top: 65%; left: 35%;
		animation: particleFloat 14s ease-in-out infinite 2s;
		background: rgba(236, 72, 153, 0.25);
		box-shadow: 0 0 6px rgba(236, 72, 153, 0.2);
	}
	.particle-4 {
		top: 25%; left: 60%;
		animation: particleFloat 18s ease-in-out infinite 1s;
		width: 4px; height: 4px;
		box-shadow: 0 0 8px rgba(99, 102, 241, 0.25);
	}
	.particle-5 {
		top: 70%; left: 80%;
		animation: particleFloat 15s ease-in-out infinite 3s;
		background: rgba(129, 140, 248, 0.25);
		box-shadow: 0 0 6px rgba(129, 140, 248, 0.2);
		width: 2px; height: 2px;
	}
	.particle-6 {
		top: 50%; left: 10%;
		animation: particleFloat 20s ease-in-out infinite 4s;
		background: rgba(192, 132, 252, 0.2);
		box-shadow: 0 0 6px rgba(192, 132, 252, 0.2);
	}

	:global(.dark) .particle-1 { box-shadow: 0 0 6px rgba(99, 102, 241, 0.3); }
	:global(.dark) .particle-2 { background: rgba(168, 85, 247, 0.5); box-shadow: 0 0 6px rgba(168, 85, 247, 0.3); }
	:global(.dark) .particle-3 { background: rgba(236, 72, 153, 0.4); box-shadow: 0 0 6px rgba(236, 72, 153, 0.3); }
	:global(.dark) .particle-4 { box-shadow: 0 0 8px rgba(99, 102, 241, 0.4); }
	:global(.dark) .particle-5 { background: rgba(129, 140, 248, 0.4); box-shadow: 0 0 6px rgba(129, 140, 248, 0.3); }
	:global(.dark) .particle-6 { background: rgba(192, 132, 252, 0.3); box-shadow: 0 0 6px rgba(192, 132, 252, 0.3); }

	@keyframes particleFloat {
		0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
		25% { transform: translate(40px, -60px) scale(1.5); opacity: 0.8; }
		50% { transform: translate(-30px, -30px) scale(0.8); opacity: 0.3; }
		75% { transform: translate(50px, 20px) scale(1.2); opacity: 0.7; }
	}

	/* ═══════════════════════════════════════════════════════════
	   HERO ANIMATIONS
	   ═══════════════════════════════════════════════════════════ */
	.hero-badge {
		animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.1s;
	}
	.hero-title {
		animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.25s;
	}
	.hero-subtitle {
		animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.4s;
	}

	@keyframes fadeSlideUp {
		from { opacity: 0; transform: translateY(30px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* ═══════════════════════════════════════════════════════════
	   DAY HEADER ENTRANCE
	   ═══════════════════════════════════════════════════════════ */
	.day-header {
		animation: fadeSlideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes fadeSlideDown {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ═══════════════════════════════════════════════════════════
	   CALENDAR GRID TRANSITIONS
	   ═══════════════════════════════════════════════════════════ */
	.calendar-grid {
		animation: gridFadeIn 0.4s ease-out both;
	}
	.slide-in-left {
		animation: slideFromRight 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.slide-in-right {
		animation: slideFromLeft 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes gridFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes slideFromRight {
		from { opacity: 0; transform: translateX(40px); }
		to { opacity: 1; transform: translateX(0); }
	}
	@keyframes slideFromLeft {
		from { opacity: 0; transform: translateX(-40px); }
		to { opacity: 1; transform: translateX(0); }
	}

	/* ═══════════════════════════════════════════════════════════
	   DAY CELL ANIMATIONS
	   ═══════════════════════════════════════════════════════════ */
	.day-cell {
		animation: cellFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.day-cell:hover {
		z-index: 2;
	}

	@keyframes cellFadeIn {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}

	/* Busy cell — Light + Dark */
	.busy-cell {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.05) 0%, rgba(236, 72, 153, 0.03) 100%);
	}
	.busy-cell:hover {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, rgba(236, 72, 153, 0.06) 100%);
	}
	:global(.dark) .busy-cell {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.04) 0%, rgba(236, 72, 153, 0.02) 100%);
	}
	:global(.dark) .busy-cell:hover {
		background: linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(236, 72, 153, 0.05) 100%);
	}

	/* Today cell — Light + Dark */
	.today-cell {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.04) 100%);
	}
	:global(.dark) .today-cell {
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(168, 85, 247, 0.03) 100%);
	}

	.today-badge {
		animation: todayPulse 3s ease-in-out infinite;
	}

	@keyframes todayPulse {
		0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3), 0 4px 12px rgba(99, 102, 241, 0.3); }
		50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0), 0 4px 12px rgba(99, 102, 241, 0.15); }
	}

	/* Event pill hover */
	.event-pill {
		transition: all 0.3s ease;
	}
	.day-cell:hover .event-pill {
		border-color: rgba(244, 63, 94, 0.3);
		background: linear-gradient(to right, rgba(244, 63, 94, 0.12), rgba(236, 72, 153, 0.08));
	}
	:global(.dark) .day-cell:hover .event-pill {
		border-color: rgba(244, 63, 94, 0.35);
		background: linear-gradient(to right, rgba(244, 63, 94, 0.2), rgba(236, 72, 153, 0.15));
	}

	/* ═══════════════════════════════════════════════════════════
	   DETAIL PANEL
	   ═══════════════════════════════════════════════════════════ */
	.detail-panel {
		animation: panelSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	@keyframes panelSlideUp {
		from { opacity: 0; transform: translateY(30px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.event-card {
		animation: fadeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	/* ═══════════════════════════════════════════════════════════
	   MODAL ANIMATIONS
	   ═══════════════════════════════════════════════════════════ */
	.modal-backdrop {
		background: rgba(0, 0, 0, 0.3);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		animation: backdropFadeIn 0.3s ease-out both;
	}

	:global(.dark) .modal-backdrop {
		background: rgba(0, 0, 0, 0.6);
	}

	.modal-content {
		animation: modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: 0.1s;
	}

	@keyframes backdropFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes modalSlideUp {
		from { opacity: 0; transform: translateY(40px) scale(0.95); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.form-field {
		animation: fadeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	/* Error shake */
	.error-shake {
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}
	@keyframes shake {
		10%, 90% { transform: translateX(-1px); }
		20%, 80% { transform: translateX(2px); }
		30%, 50%, 70% { transform: translateX(-3px); }
		40%, 60% { transform: translateX(3px); }
	}

	/* Glass input focus glow */
	.glass-input:focus {
		box-shadow:
			0 0 0 2px rgba(99, 102, 241, 0.1),
			0 8px 24px rgba(99, 102, 241, 0.05);
	}

	:global(.dark) .glass-input:focus {
		box-shadow:
			0 0 0 2px rgba(99, 102, 241, 0.15),
			0 8px 24px rgba(99, 102, 241, 0.08);
	}

	/* Submit button glow */
	.submit-btn:not(:disabled):hover {
		box-shadow:
			0 8px 30px rgba(99, 102, 241, 0.35),
			0 0 0 1px rgba(99, 102, 241, 0.2);
	}

	/* Add Busy button glow */
	.add-busy-btn:hover {
		box-shadow:
			0 8px 30px rgba(99, 102, 241, 0.3),
			0 0 0 1px rgba(99, 102, 241, 0.15);
	}

	/* Month title */
	.month-title {
		animation: fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	/* Date inputs — dark mode calendar picker */
	:global(.dark) input[type="date"]::-webkit-calendar-picker-indicator {
		filter: invert(0.6);
		cursor: pointer;
	}

	/* ═══════════════════════════════════════════════════════════
	   REDUCED MOTION
	   ═══════════════════════════════════════════════════════════ */
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
