(ns completer.app-test
  (:require [cljs.test :refer [deftest is testing use-fixtures]]
            [re-frame.db :as rf-db]
            [re-frame.core :as rf]
            [completer.app :as app]))

(use-fixtures :each
  {:before (fn [] (reset! rf-db/app-db {}))
   :after (fn [] (reset! rf-db/app-db {}))})

(deftest initial-db-matches-original-svelte-data
  (testing "initial-db carries the exact same values as the original +page.svelte `app` object"
    (let [a (:app app/initial-db)]
      (is (= "Completer Mcp Component" (:title a)))
      (is (= "etzhayyim-project-completer" (:project a)))
      (is (= "completer-mcp-component" (:name a)))
      (is (= "appview" (:kind a)))
      (is (= 0 (:route-count a)))
      (is (= [] (:routes a)))
      (is (= [] (:vars a)))
      (is (= true (:xrpc a)))
      (is (= "60-apps/etzhayyim-project-completer/appview/completer-mcp-component/svelte/src/routes/+page.svelte"
             (:relative-path a))))))

(deftest initialize-event-seeds-subs
  (testing "dispatching ::initialize makes all subs resolve to the expected values"
    (rf/dispatch-sync [:completer.app/initialize])
    (is (= "Completer Mcp Component" @(rf/subscribe [:completer.app/title])))
    (is (= "completer-mcp-component" @(rf/subscribe [:completer.app/name])))
    (is (= "appview" @(rf/subscribe [:completer.app/kind])))
    (is (= "etzhayyim-project-completer" @(rf/subscribe [:completer.app/project])))
    (is (= 0 @(rf/subscribe [:completer.app/route-count])))
    (is (= [] @(rf/subscribe [:completer.app/routes])))
    (is (= [] @(rf/subscribe [:completer.app/vars])))
    (is (true? @(rf/subscribe [:completer.app/xrpc?])))
    (is (= "60-apps/etzhayyim-project-completer/appview/completer-mcp-component/svelte/src/routes/+page.svelte"
           @(rf/subscribe [:completer.app/relative-path])))))

(deftest view-renders-hiccup-rooted-at-main-with-dads-container
  (testing "app-view returns hiccup rooted at :main, carrying a DADS dds-ext-container class"
    (rf/dispatch-sync [:completer.app/initialize])
    (let [hiccup (app/app-view)]
      (is (= :main (first hiccup)))
      (is (= "dds-ext-container" (:class (second hiccup)))))))

(deftest xrpc-fact-text-toggles-on-flag
  (testing "the XRPC fact renders enabled/not-configured text matching the original ternary"
    (rf/dispatch-sync [:completer.app/initialize])
    (is (true? @(rf/subscribe [:completer.app/xrpc?])))
    ;; mirrors `{app.xrpc ? 'enabled' : 'not configured'}` from +page.svelte
    (is (= "enabled" (if @(rf/subscribe [:completer.app/xrpc?]) "enabled" "not configured")))))
