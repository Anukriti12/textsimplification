import React from "react";
import styles from "./styles.module.css";

const Footer = () => (
  <footer className={styles.footer}>
    <img
      src="images/nidilrr_logo.png"
      alt="NIDILRR – National Institute on Disability, Independent Living, and Rehabilitation Research"
      className={styles.logo}
    />
    <p className={styles.text}>
      The contents of this website were developed under a grant from the
      National Institute on Disability, Independent Living, and
      Rehabilitation Research (NIDILRR grant number 90REGE0026‑01‑00)
      funding the Center for Research and Education on Accessible
      Technology and Experiences (CREATE). NIDILRR is a Center within the
      Administration for Community Living (ACL), Department of Health and
      Human Services (HHS). The contents of this website do not necessarily
      represent the policy of NIDILRR, ACL, or HHS, and you should not
      assume endorsement by the Federal Government.
    </p>
  </footer>
);

export default Footer;
