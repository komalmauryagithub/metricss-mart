(function attendanceAutoCheckoutBootstrap() {
  function finalizeOnLogout() {
    return Promise.resolve();
  }

  window.AttendanceAutoCheckout = {
    finalizeOnLogout,
  };
})();
