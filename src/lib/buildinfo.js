// When this build fetched its data, and whether it came from the live API.
export const BUILT_AT = new Date();

const IST = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
});
export const builtAtIst = `${IST.format(BUILT_AT)} IST`;

// Set to false when any feed falls back to the sample data.
export const dataStatus = { live: true };
export function markSampleData() {
  dataStatus.live = false;
}
