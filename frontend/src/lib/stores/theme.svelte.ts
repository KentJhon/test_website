let darkMode = $state(false);

if (typeof window !== 'undefined') {
	const saved = localStorage.getItem('theme-dark');
	if (saved !== null) {
		darkMode = saved === 'true';
	} else {
		darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
	}
}

$effect.root(() => {
	$effect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('theme-dark', String(darkMode));
		}
	});
});

export function getIsDark(): boolean {
	return darkMode;
}

export function toggleTheme(): void {
	darkMode = !darkMode;
}
