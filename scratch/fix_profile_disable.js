const fs = require('fs');
let js = fs.readFileSync('employee-profile.js', 'utf8');

const regex = /populateSummary\(result\.data\);[\s\r\n]*populateForm\(result\.data\);[\s\r\n]*setBanner\([\s\S]*?\);/g;

js = js.replace(regex, match => {
    return `populateSummary(result.data);
    populateForm(result.data);

    if (result.data.profile_setup_status === "completed") {
      setStatusBadge("completed");
      disableForm(
        "You have already submitted your profile form. Your details are saved.",
        "success"
      );
      setBanner(
        "You have already submitted your profile form. Your details are saved.",
        "success"
      );
      return;
    }

    setBanner(
      "Fill the remaining details below and submit once you are done.",
      "success"
    );`;
});

fs.writeFileSync('employee-profile.js', js);
console.log('Fixed profile setup disable check in UI!');
