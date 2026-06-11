# AO3: Reading Time & Quality Score

Get a quick feel for any fic at a glance:
- **Reading Time Bar** ⏱️ – see how long it’ll take to read.
  - **NEW** - View chapter reading times at the start of works!
- **Quality Score Bar** ⭐ – a smarter kudos/hits ratio that accounts for fic length.
- **Both features are independent** — use one or both

🚨**Important Note**🚨
> The name "Quality Score" is shorthand — it measures **reader engagement** (kudos-to-hits ratio adjusted for length), **not the quality of anyone's writing**. A lower score doesn't mean a fic is bad. It can reflect genre trends (i.e. omegaverse fics tend to score lower), smaller audiences, posting timing, or a dozen other things that have nothing to do with how good the writing is.  
>  
> This feature exists to help **you, the reader**, privately prioritize your reading list. That's it.  
>  
> **Do not share scores on social media, send them to authors, or use them to rank or criticize anyone's work.** In fact, don't discuss them with anyone at all. If I see this feature being weaponized against writers, **I will unlist the script without warning.**


---
### ✨ Features

#### **Reading Time**
- Estimates reading time based on word count.  
- Fully customizable reading speed (**WPM setting**) so it matches your pace.  
- Color thresholds highlight short, medium, and long reads at a glance.  

![Reading Time](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_1.png "Reading Time Settings")

##### Chapter Reading Time & Word Count
- Provides reading time and word count at the start of the chapter
- Three different visual options (Default, Notice, and Time Only)

<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_10.png" alt="Chapter Reading Time Settings" width="600">


#### **Quality Score**
- Uses **kudos + hits + word count** to calculate engagement.  
- **Formula:** kudos per hit, adjusted by (words ÷ 5000)^0.4.   
- Word-based scoring avoids:  
  - Punishing long fics just for being long.  
  - Rewarding fics split into tiny chapters.  
- **Normalization (optional):**
  - Converts raw scores into a 0–100 scale.
  - You choose the **“max raw score”** baseline (default: 22). Fics that score higher than that will appear as "100".
  - **Best practice:** Pick a max score that matches the **strongest high-performing fics** in your fandom, not the single highest outlier. Larger fandoms usually peak a bit lower, smaller ones a bit higher.
  - Want more forgiving scores? Set the max score lower.
  - Configurable thresholds color-code scores.
  - **Hide works by score:** Optionally filter out works below a minimum quality score threshold.
- **Hide scores on specific works:** Exclude specific works from scoring by work ID—useful for authors who don't want to see scores on their own works.

![Quality Score](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_2.png "Quality Score Settings")

### **Highly Customizable**
- Hide work metrics on blurbs (kudos, hits, bookmarks, and comments)
- Three different visual options (Default, Colored, and Bar)
- Optional icons to go with [Rose Pine site skin](https://archiveofourown.org/works/69993411) or [Stat Icons with Hover Text](https://archiveofourown.org/works/55604875/chapters/141130912)

![Visual Options](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_3.png)

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_5.png "Reading Time & Quality Score Bar")

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_9.png "Reading Time & Quality Score Bar")


![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_6.png "Reading Time & Quality Score Bar")

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_7.png "Reading Time & Quality Score Bar")

![Bar](https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/reading-time-quality-score/images/image_reading_time_quality_score_8.png "Reading Time & Quality Score Bar")

---

### ⚙️ How to Use

>  **⚠️ Important for Chromium-based browsers:** If you're using Chrome, Brave, Vivaldi, or Microsoft Edge on PC, an extra activation step is required. [Follow these instructions.](https://www.tampermonkey.net/faq.php?locale=en#Q209). For the Tampermonkey iOS app, see [this video](https://www.youtube.com/watch?v=e7Sme3FY0vI).

1. Install with a userscript manager:  
   - **Tampermonkey**
     - [Chrome/Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)  
     - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)  
     - [Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)  
     - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)   
3. Click **Userscripts** → **Reading Time & Quality Score** to open settings.
4. **Save** your changes for them to go into effect.

> 💡 **Using AO3 on multiple devices?** Check out [AO3: Script Sync](https://greasyfork.org/en/scripts/568443-ao3-script-sync) — it automatically syncs your settings and data across devices using Google Sheets.

---

### 🙌 Credits
- [cupkax’s improved Quality Score script](https://greasyfork.org/en/scripts/482730-ao3-quality-score-adjusted-kudos-hits-ratio)  
- [lomky’s Estimated Reading Time v2](https://greasyfork.org/en/scripts/418872-ao3-estimated-reading-time-v2)  

---

## 📜 Check Out My Other Scripts

- [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942) – Block works on AO3 based on tags, authors, titles, word counts, and more.
- [AO3: Quick Hide](https://greasyfork.org/en/scripts/564383) - Quickly hide works, bookmarks, and comments while browsing AO3.
- [AO3: Script Sync](https://greasyfork.org/en/scripts/568443) Sync AO3 userscript settings and data across multiple devices.
- [AO3: Site Wizard](https://greasyfork.org/en/scripts/550537) – Customize fonts, sizes, and work spacing site-wide.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820) – Quickly switch between AO3 site skins.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571) – Quick links to the latest chapter of any work.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623) – Prevent accidentally re-kudosing works.
- [AO3: Reorder Ship Tags](https://greasyfork.org/en/scripts/562812) – Automatically reorder romantic ships (/) before platonic ships (&).
- [AO3: Auto Pseud](https://greasyfork.org/en/scripts/556232) – Auto-select pseuds based on fandom when commenting and bookmarking.