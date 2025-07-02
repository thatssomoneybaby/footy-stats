export async function getTeams() {
  try {
    const res = await fetch(`${BASE}/teams-all`);
    if (!res.ok) {
      console.error('Teams API error:', res.status, res.statusText);
      const errorData = await res.text();
      console.error('Error details:', errorData);
      return [];
    }
    return res.json();
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    return [];
  }
}

export async function getTeamSummary(teamName) {
  try {
    const res = await fetch(
      `${BASE}/teams-all?teamName=${encodeURIComponent(teamName)}`
    );
    if (!res.ok) {
      console.error('Team summary API error:', res.status, res.statusText);
      const errorData = await res.text();
      console.error('Error details:', errorData);
      return null;
    }
    return res.json();
  } catch (error) {
    console.error('Failed to fetch team summary:', error);
    return null;
  }
}